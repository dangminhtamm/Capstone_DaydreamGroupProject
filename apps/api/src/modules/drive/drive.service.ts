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
  shouldStoreGoogleRawPayloads,
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
  raw_json: drive_v3.Schema$File | null;
};

type GoogleUserWithTokens = {
  id: string;
  google_access_token: string | null;
  google_refresh_token: string | null;
};

type DriveClientContext = {
  user: GoogleUserWithTokens;
  drive: drive_v3.Drive;
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
      oauthMode: this.getOauthMode(connection.scopes),
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
      select: {
        id: true,
        external_id: true,
        name: true,
        mime_type: true,
        web_view_link: true,
        icon_link: true,
        thumbnail_link: true,
        size: true,
        modified_time: true,
        extracted_text: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: [{ modified_time: 'desc' }, { updated_at: 'desc' }],
      take: 50,
    });
  }

  async listImportCandidates(supabaseId: string, options: { limit?: number; query?: string } = {}) {
    const { user, drive } = await this.getDriveClientContext(supabaseId);
    const maxFiles = Math.min(Math.max(options.limit ?? 25, 1), 100);

    try {
      const response = await drive.files.list({
        q: this.buildDriveListQuery(options.query),
        pageSize: maxFiles,
        orderBy: 'modifiedTime desc',
        fields: `nextPageToken, files(${this.getDriveFileFields()})`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const files = response.data.files ?? [];
      const externalIds = files.map((file) => file.id).filter((id): id is string => Boolean(id));
      const importedIds = externalIds.length
        ? await this.prisma.googleDriveFile.findMany({
            where: {
              user_id: user.id,
              external_id: { in: externalIds },
            },
            select: { external_id: true },
          })
        : [];
      const importedSet = new Set(importedIds.map((file) => file.external_id));

      return {
        message: 'Google Drive import candidates fetched successfully.',
        count: files.length,
        candidates: files
          .filter((file) => file.id && file.name && file.mimeType)
          .map((file) => ({
            id: file.id!,
            name: file.name!,
            mimeType: file.mimeType!,
            webViewLink: file.webViewLink ?? null,
            iconLink: file.iconLink ?? null,
            thumbnailLink: file.thumbnailLink ?? null,
            size: file.size ?? null,
            modifiedTime: file.modifiedTime ?? null,
            alreadyImported: importedSet.has(file.id!),
          })),
      };
    } catch (error) {
      await recordGoogleSyncFailure(this.prisma, { userId: user.id, source: 'drive', error });
      if (this.isInsufficientScopeError(error)) {
        throw new ForbiddenException('Reconnect Google to grant Drive permission.');
      }
      console.error('Failed to list Google Drive import candidates:', error);
      throw new InternalServerErrorException('Could not list Google Drive files for import');
    }
  }

  async importSelectedFiles(supabaseId: string, fileIds: string[]) {
    const { user, drive } = await this.getDriveClientContext(supabaseId);
    const selectedIds = this.normalizeSelectedIds(fileIds, 50);

    try {
      const normalizedFiles: GoogleDriveFileRow[] = [];
      for (const fileId of selectedIds) {
        const response = await drive.files.get({
          fileId,
          fields: this.getDriveFileFields(),
          supportsAllDrives: true,
        });
        const normalized = this.normalizeFile(response.data);
        if (normalized) normalizedFiles.push(normalized);
      }

      const queuedIndexingJobs = await this.saveFilesAndQueueIndexing(user.id, normalizedFiles);
      await recordGoogleSyncSuccess(this.prisma, { userId: user.id, source: 'drive' });

      return {
        message: 'Selected Google Drive files imported; Drive memory indexing queued.',
        syncedCount: normalizedFiles.length,
        requestedCount: selectedIds.length,
        queuedIndexingJobs,
        memoryIndexingStatus: 'queued',
      };
    } catch (error) {
      await recordGoogleSyncFailure(this.prisma, { userId: user.id, source: 'drive', error });
      if (this.isInsufficientScopeError(error)) {
        throw new ForbiddenException('Reconnect Google to grant Drive permission.');
      }
      console.error('Failed to import selected Google Drive files:', error);
      throw new InternalServerErrorException('Could not import selected Google Drive files');
    }
  }

  async syncGoogleDriveFiles(supabaseId: string, options: { limit?: number } = {}) {
    const { user, drive } = await this.getDriveClientContext(supabaseId);
    const maxFiles = Math.min(Math.max(options.limit ?? 50, 1), 200);

    try {
      const response = await drive.files.list({
        q: this.buildDriveListQuery(),
        pageSize: maxFiles,
        orderBy: 'modifiedTime desc',
        fields: `nextPageToken, files(${this.getDriveFileFields()})`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const normalizedFiles = (response.data.files ?? [])
        .map((file) => this.normalizeFile(file))
        .filter((file): file is GoogleDriveFileRow => Boolean(file));

      const queuedIndexingJobs = await this.saveFilesAndQueueIndexing(user.id, normalizedFiles);

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

  private async getDriveClientContext(supabaseId: string): Promise<DriveClientContext> {
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
    return { user, drive };
  }

  private getDriveFileFields() {
    return 'id, name, mimeType, webViewLink, iconLink, thumbnailLink, size, modifiedTime, owners(displayName,emailAddress), lastModifyingUser(displayName,emailAddress)';
  }

  private buildDriveListQuery(query?: string) {
    const filters = ["trashed = false", "mimeType != 'application/vnd.google-apps.folder'"];
    const normalizedQuery = query?.trim();
    if (normalizedQuery) {
      filters.push(`name contains '${this.escapeDriveQueryValue(normalizedQuery)}'`);
    }
    return filters.join(' and ');
  }

  private escapeDriveQueryValue(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  private normalizeSelectedIds(fileIds: string[], maxItems: number) {
    return Array.from(new Set(fileIds.map((id) => id.trim()).filter(Boolean))).slice(0, maxItems);
  }

  private async saveFilesAndQueueIndexing(userId: string, files: GoogleDriveFileRow[]) {
    return this.prisma.$transaction(async (tx) => {
      let queuedCount = 0;

      for (const file of files) {
        const savedFile = await tx.googleDriveFile.upsert({
          where: {
            user_id_external_id: {
              user_id: userId,
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
            user_id: userId,
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
          userId,
          driveFileId: savedFile.id,
          externalId: savedFile.external_id,
          fileName: savedFile.name,
          mimeType: savedFile.mime_type,
        });
        queuedCount += 1;
      }

      return queuedCount;
    });
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
      raw_json: shouldStoreGoogleRawPayloads() ? file : null,
    };
  }

  private getOauthMode(scopes: string[]) {
    const workspaceScopes = getAllGoogleWorkspaceScopes();
    const normalizedScopes = new Set(scopes);
    return workspaceScopes.every((scope) => normalizedScopes.has(scope))
      ? 'all_google_sources'
      : 'source_scoped';
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
        locked_by: null,
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
