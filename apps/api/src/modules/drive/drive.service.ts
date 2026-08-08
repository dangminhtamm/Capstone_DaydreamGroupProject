import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { drive_v3, google } from 'googleapis';
import { invalidateUserSearchCache } from '../../common/cache/search-answer-cache';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptOAuthToken, encryptOAuthToken } from '../calendar/oauth-token-crypto';
import {
  GOOGLE_SOURCE_SCOPES,
  getAllGoogleWorkspaceScopes,
  getGoogleConnectionStatus,
  recordGoogleSyncFailure,
  recordGoogleSyncSuccess,
} from '../google-connections/google-connections';

type GoogleDriveFileRow = {
  external_id: string;
  name: string;
  mime_type: string;
  web_view_link: string | null;
  icon_link: string | null;
  thumbnail_link: string | null;
  size: bigint | null;
  modified_time: Date | null;
  raw_json: drive_v3.Schema$File;
};

@Injectable()
export class DriveService {
  constructor(private readonly prisma: PrismaService) {}

  private getRedirectUri() {
    const apiBaseUrl = process.env.API_PUBLIC_URL || process.env.API_URL || 'http://localhost:3001';
    return (
      process.env.GOOGLE_REDIRECT_URI ||
      process.env.GOOGLE_CALLBACK_URL ||
      `${apiBaseUrl.replace(/\/$/, '')}/api/calendar/oauth/callback`
    );
  }

  private getOAuthClient() {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new UnauthorizedException('Google OAuth is not configured.');
    }

    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      this.getRedirectUri(),
    );
  }

  private async getGoogleUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
    });

    if (!user) throw new NotFoundException('User not found');
    if (!user.google_access_token && !user.google_refresh_token) {
      throw new UnauthorizedException('User has not connected Google.');
    }

    return user;
  }

  async getConnectionStatus(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: {
        id: true,
        google_connected: true,
        google_access_token: true,
        google_refresh_token: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const [fileCount, latestFile] = await Promise.all([
      this.prisma.googleDriveFile.count({ where: { user_id: user.id } }),
      this.prisma.googleDriveFile.findFirst({
        where: { user_id: user.id },
        orderBy: { updated_at: 'desc' },
        select: { updated_at: true },
      }),
    ]);

    const fallbackConnected = user.google_connected && Boolean(user.google_refresh_token || user.google_access_token);
    const connection = await getGoogleConnectionStatus(this.prisma, user.id, 'drive', fallbackConnected);

    return {
      source: 'drive',
      oauthMode: 'all_google_sources',
      connected: connection.connected && fallbackConnected,
      scopes: connection.scopes,
      requestedScopes: GOOGLE_SOURCE_SCOPES.drive,
      workspaceScopes: getAllGoogleWorkspaceScopes(),
      fileCount,
      lastSyncedAt: connection.lastSyncAt ?? latestFile?.updated_at ?? null,
      lastError: connection.lastError,
      lastErrorAt: connection.lastErrorAt,
      syncCursor: connection.syncCursor,
    };
  }

  async getFilesFromDb(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('User not found');

    return this.prisma.googleDriveFile.findMany({
      where: { user_id: user.id },
      orderBy: [{ modified_time: 'desc' }, { updated_at: 'desc' }],
      take: 50,
    });
  }

  async syncGoogleDriveFiles(supabaseId: string, options: { limit?: number } = {}) {
    const user = await this.getGoogleUser(supabaseId);
    const oauth2Client = this.getOAuthClient();
    oauth2Client.setCredentials({
      access_token: decryptOAuthToken(user.google_access_token),
      refresh_token: decryptOAuthToken(user.google_refresh_token),
    });
    oauth2Client.on('tokens', async (tokens) => {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ...(tokens.access_token && { google_access_token: encryptOAuthToken(tokens.access_token) }),
          ...(tokens.refresh_token && { google_refresh_token: encryptOAuthToken(tokens.refresh_token) }),
        },
      });
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const maxFiles = Math.min(Math.max(options.limit ?? 50, 1), 200);

    try {
      const response = await drive.files.list({
        q: "trashed = false and mimeType != 'application/vnd.google-apps.folder'",
        pageSize: maxFiles,
        orderBy: 'modifiedTime desc',
        fields: 'nextPageToken, files(id, name, mimeType, webViewLink, iconLink, thumbnailLink, size, modifiedTime, owners(displayName,emailAddress), lastModifyingUser(displayName,emailAddress))',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const normalizedFiles = (response.data.files ?? [])
        .map((file) => this.normalizeFile(file))
        .filter((file): file is GoogleDriveFileRow => Boolean(file));

      const queuedIndexingJobs = await this.prisma.$transaction(async (tx) => {
        let queuedCount = 0;

        for (const file of normalizedFiles) {
          const savedFile = await tx.googleDriveFile.upsert({
            where: {
              user_id_external_id: {
                user_id: user.id,
                external_id: file.external_id,
              },
            },
            update: {
              name: file.name,
              mime_type: file.mime_type,
              web_view_link: file.web_view_link,
              icon_link: file.icon_link,
              thumbnail_link: file.thumbnail_link,
              size: file.size,
              modified_time: file.modified_time,
              raw_json: file.raw_json as any,
            },
            create: {
              user_id: user.id,
              external_id: file.external_id,
              name: file.name,
              mime_type: file.mime_type,
              web_view_link: file.web_view_link,
              icon_link: file.icon_link,
              thumbnail_link: file.thumbnail_link,
              size: file.size,
              modified_time: file.modified_time,
              raw_json: file.raw_json as any,
            },
          });

          await this.enqueueDriveIndexingJob(tx, {
            userId: user.id,
            driveFileId: savedFile.id,
            externalId: savedFile.external_id,
            fileName: savedFile.name,
            mimeType: savedFile.mime_type,
          });
          queuedCount += 1;
        }

        return queuedCount;
      });

      await recordGoogleSyncSuccess(this.prisma, { userId: user.id, source: 'drive' });

      return {
        message: 'Google Drive files synced successfully; Drive memory indexing queued.',
        syncedCount: normalizedFiles.length,
        queuedIndexingJobs,
        memoryIndexingStatus: 'queued',
      };
    } catch (error) {
      await recordGoogleSyncFailure(this.prisma, { userId: user.id, source: 'drive', error });
      if (this.isInsufficientScopeError(error)) {
        throw new ForbiddenException('Reconnect Google to grant Drive permission.');
      }
      console.error('Failed to sync Google Drive files:', error);
      throw new InternalServerErrorException('Could not sync Google Drive files to database');
    }
  }

  private normalizeFile(file: drive_v3.Schema$File): GoogleDriveFileRow | null {
    if (!file.id || !file.name || !file.mimeType) return null;

    return {
      external_id: file.id,
      name: file.name,
      mime_type: file.mimeType,
      web_view_link: file.webViewLink ?? null,
      icon_link: file.iconLink ?? null,
      thumbnail_link: file.thumbnailLink ?? null,
      size: file.size ? BigInt(file.size) : null,
      modified_time: file.modifiedTime ? new Date(file.modifiedTime) : null,
      raw_json: file,
    };
  }

  private async enqueueDriveIndexingJob(
    tx: any,
    input: {
      userId: string;
      driveFileId: string;
      externalId: string;
      fileName: string;
      mimeType: string;
    },
  ) {
    const job = await tx.indexingOutbox.upsert({
      where: {
        job_type_source_type_source_id: {
          job_type: 'index_memory',
          source_type: 'drive',
          source_id: input.driveFileId,
        },
      },
      update: {
        user_id: input.userId,
        status: 'pending',
        retry_count: 0,
        error: null,
        payload: {
          externalId: input.externalId,
          sourceTitle: input.fileName,
          mimeType: input.mimeType,
        },
        run_after: new Date(),
        locked_at: null,
        processed_at: null,
      },
      create: {
        user_id: input.userId,
        job_type: 'index_memory',
        source_type: 'drive',
        source_id: input.driveFileId,
        status: 'pending',
        payload: {
          externalId: input.externalId,
          sourceTitle: input.fileName,
          mimeType: input.mimeType,
        },
      },
    });

    await this.expireSearchCache(tx, input.userId);
    return job;
  }

  private async expireSearchCache(tx: any, userId: string) {
    await tx.searchHistory?.updateMany?.({
      where: {
        user_id: userId,
        expires_at: { gt: new Date() },
      },
      data: { expires_at: new Date() },
    });
    await invalidateUserSearchCache(userId);
  }

  private isInsufficientScopeError(error: unknown) {
    const maybeError = error as {
      code?: number;
      response?: { status?: number; data?: unknown };
      message?: string;
    };
    const message = `${maybeError.message ?? ''} ${JSON.stringify(maybeError.response?.data ?? {})}`.toLowerCase();

    return (
      maybeError.code === 403 ||
      maybeError.response?.status === 403 ||
      message.includes('insufficient') ||
      message.includes('permission') ||
      message.includes('scope')
    );
  }
}
