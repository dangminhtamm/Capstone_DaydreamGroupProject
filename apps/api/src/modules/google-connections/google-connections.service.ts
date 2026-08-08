import { Injectable, NotFoundException } from '@nestjs/common';
import { google } from 'googleapis';
import { invalidateUserSearchCache } from '../../common/cache/search-answer-cache';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptOAuthToken } from '../calendar/oauth-token-crypto';
import { GOOGLE_WORKSPACE_SOURCES } from './google-connections';

type AuthenticatedUserInput = {
  supabaseId: string;
  email: string;
};

type DisconnectOptions = {
  deleteSyncedData?: boolean;
};

const GOOGLE_SOURCE_TYPES = ['calendar', 'gmail', 'drive', 'contact'] as const;

@Injectable()
export class GoogleConnectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async disconnectGoogle(authUser: AuthenticatedUserInput, options: DisconnectOptions = {}) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: authUser.supabaseId },
      select: {
        id: true,
        google_access_token: true,
        google_refresh_token: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const revoke = await this.revokeGoogleTokenBestEffort({
      accessToken: user.google_access_token,
      refreshToken: user.google_refresh_token,
    });

    const deletedCounts = options.deleteSyncedData
      ? await this.disconnectAndDeleteGoogleData(user.id)
      : await this.disconnectOnly(user.id);

    await invalidateUserSearchCache(user.id);

    return {
      disconnected: true,
      deleteSyncedData: Boolean(options.deleteSyncedData),
      revoke,
      deletedCounts,
      message: options.deleteSyncedData
        ? 'Google disconnected and synced Google data was deleted.'
        : 'Google disconnected. Synced data was kept in the workspace.',
    };
  }

  private async disconnectOnly(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          google_connected: false,
          google_access_token: null,
          google_refresh_token: null,
        },
      });

      await this.markConnectionsDisconnected(tx, userId);
      await this.expireSearchHistory(tx, userId);
    });

    return {
      calendarEvents: 0,
      gmailMessages: 0,
      driveFiles: 0,
      contacts: 0,
      memoryChunks: 0,
      indexingJobs: 0,
    };
  }

  private async disconnectAndDeleteGoogleData(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          google_connected: false,
          google_access_token: null,
          google_refresh_token: null,
        },
      });

      await this.markConnectionsDisconnected(tx, userId);

      const [indexingJobs, memoryChunks, gmailMessages, driveFiles, contacts, calendarEvents] = await Promise.all([
        tx.indexingOutbox.deleteMany({
          where: {
            user_id: userId,
            source_type: { in: [...GOOGLE_SOURCE_TYPES] },
          },
        }),
        tx.memoryChunk.deleteMany({
          where: {
            userId,
            sourceType: { in: [...GOOGLE_SOURCE_TYPES] },
          },
        }),
        tx.gmailMessage.deleteMany({ where: { user_id: userId } }),
        tx.googleDriveFile.deleteMany({ where: { user_id: userId } }),
        tx.googleContact.deleteMany({ where: { user_id: userId } }),
        tx.calendarEvent.deleteMany({ where: { user_id: userId } }),
      ]);

      await tx.$executeRaw`
        UPDATE memory_chunks
        SET metadata = COALESCE(metadata, '{}'::jsonb) - 'calendarEventIds' - 'calendarEvents',
            updated_at = now()
        WHERE user_id = ${userId}
          AND source_type = 'diary'
          AND (
            metadata ? 'calendarEventIds'
            OR metadata ? 'calendarEvents'
          )
      `;

      await this.expireSearchHistory(tx, userId);

      return {
        calendarEvents: calendarEvents.count,
        gmailMessages: gmailMessages.count,
        driveFiles: driveFiles.count,
        contacts: contacts.count,
        memoryChunks: memoryChunks.count,
        indexingJobs: indexingJobs.count,
      };
    });
  }

  private async markConnectionsDisconnected(tx: any, userId: string) {
    try {
      await tx.$executeRawUnsafe(
        `
        UPDATE google_connections
        SET connected = FALSE,
            last_error = NULL,
            last_error_at = NULL,
            updated_at = now()
        WHERE user_id = $1
          AND source = ANY($2)
        `,
        userId,
        GOOGLE_WORKSPACE_SOURCES,
      );
    } catch {
      // The migration may not have been applied yet in local/demo setups.
    }
  }

  private async expireSearchHistory(tx: any, userId: string) {
    await tx.searchHistory?.updateMany?.({
      where: {
        user_id: userId,
        expires_at: { gt: new Date() },
      },
      data: { expires_at: new Date() },
    });
  }

  private async revokeGoogleTokenBestEffort(input: {
    accessToken: string | null;
    refreshToken: string | null;
  }) {
    const encryptedToken = input.refreshToken ?? input.accessToken;
    if (!encryptedToken) {
      return {
        attempted: false,
        revoked: false,
        reason: 'No Google OAuth token was stored.',
      };
    }

    try {
      const token = decryptOAuthToken(encryptedToken);
      if (!token) {
        return {
          attempted: false,
          revoked: false,
          reason: 'No Google OAuth token was stored.',
        };
      }
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );
      await oauth2Client.revokeToken(token);
      return {
        attempted: true,
        revoked: true,
        reason: null,
      };
    } catch (error) {
      return {
        attempted: true,
        revoked: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
