import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { gmail_v1, google } from 'googleapis';
import { invalidateUserSearchCache } from '../../common/cache/search-answer-cache';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptOAuthToken, encryptOAuthToken } from '../calendar/oauth-token-crypto';

type GmailMessageRow = {
  external_id: string;
  thread_id: string | null;
  sender: string;
  subject: string;
  snippet: string | null;
  body: string;
  received_at: Date | null;
  raw_json: gmail_v1.Schema$Message;
};

@Injectable()
export class GmailService {
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

    const [messageCount, latestMessage] = await Promise.all([
      this.prisma.gmailMessage.count({ where: { user_id: user.id } }),
      this.prisma.gmailMessage.findFirst({
        where: { user_id: user.id },
        orderBy: [{ received_at: 'desc' }, { updated_at: 'desc' }],
        select: { updated_at: true, received_at: true },
      }),
    ]);

    return {
      connected: user.google_connected && Boolean(user.google_refresh_token || user.google_access_token),
      messageCount,
      lastSyncedAt: latestMessage?.updated_at ?? latestMessage?.received_at ?? null,
    };
  }

  async getMessagesFromDb(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('User not found');

    return this.prisma.gmailMessage.findMany({
      where: { user_id: user.id },
      orderBy: [{ received_at: 'desc' }, { updated_at: 'desc' }],
      take: 50,
    });
  }

  async syncGmailMessages(supabaseId: string, options: { limit?: number } = {}) {
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

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const maxMessages = Math.min(Math.max(options.limit ?? 25, 1), 100);

    try {
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: maxMessages,
        q: 'newer_than:90d -in:spam -in:trash',
      });

      const messageRefs = listResponse.data.messages ?? [];
      const normalizedMessages: GmailMessageRow[] = [];

      for (const ref of messageRefs) {
        if (!ref.id) continue;
        const response = await gmail.users.messages.get({
          userId: 'me',
          id: ref.id,
          format: 'full',
        });
        const normalized = this.normalizeMessage(response.data);
        if (normalized) normalizedMessages.push(normalized);
      }

      const queuedIndexingJobs = await this.prisma.$transaction(async (tx) => {
        let queuedCount = 0;

        for (const message of normalizedMessages) {
          const savedMessage = await tx.gmailMessage.upsert({
            where: {
              user_id_external_id: {
                user_id: user.id,
                external_id: message.external_id,
              },
            },
            update: {
              thread_id: message.thread_id,
              sender: message.sender,
              subject: message.subject,
              snippet: message.snippet,
              body: message.body,
              received_at: message.received_at,
              raw_json: message.raw_json as any,
            },
            create: {
              user_id: user.id,
              external_id: message.external_id,
              thread_id: message.thread_id,
              sender: message.sender,
              subject: message.subject,
              snippet: message.snippet,
              body: message.body,
              received_at: message.received_at,
              raw_json: message.raw_json as any,
            },
          });

          await this.enqueueGmailIndexingJob(tx, {
            userId: user.id,
            gmailMessageId: savedMessage.id,
            externalId: savedMessage.external_id,
            subject: savedMessage.subject,
          });
          queuedCount += 1;
        }

        return queuedCount;
      });

      return {
        message: 'Gmail messages synced successfully; Gmail memory indexing queued.',
        syncedCount: normalizedMessages.length,
        queuedIndexingJobs,
        memoryIndexingStatus: 'queued',
      };
    } catch (error) {
      if (this.isInsufficientScopeError(error)) {
        throw new ForbiddenException('Reconnect Google to grant Gmail permission.');
      }
      console.error('Failed to sync Gmail messages:', error);
      throw new InternalServerErrorException('Could not sync Gmail messages to database');
    }
  }

  private normalizeMessage(message: gmail_v1.Schema$Message): GmailMessageRow | null {
    if (!message.id) return null;

    const headers = message.payload?.headers ?? [];
    const sender = this.getHeader(headers, 'From') || 'Unknown sender';
    const subject = this.getHeader(headers, 'Subject') || '(no subject)';
    const headerDate = this.getHeader(headers, 'Date');
    const internalDate = message.internalDate ? Number(message.internalDate) : NaN;
    const receivedAt = Number.isFinite(internalDate)
      ? new Date(internalDate)
      : headerDate
        ? new Date(headerDate)
        : null;
    const body = this.extractBody(message.payload) || message.snippet || '';

    return {
      external_id: message.id,
      thread_id: message.threadId ?? null,
      sender,
      subject,
      snippet: message.snippet ?? null,
      body,
      received_at: receivedAt && Number.isFinite(receivedAt.getTime()) ? receivedAt : null,
      raw_json: message,
    };
  }

  private getHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string) {
    return headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value?.trim() ?? null;
  }

  private extractBody(payload?: gmail_v1.Schema$MessagePart): string {
    if (!payload) return '';

    const plainParts: string[] = [];
    const htmlParts: string[] = [];
    this.collectBodyParts(payload, plainParts, htmlParts);

    const plainText = plainParts.join('\n\n').trim();
    if (plainText) return this.normalizeEmailText(plainText);

    const htmlText = htmlParts.join('\n\n').trim();
    if (htmlText) return this.normalizeEmailText(this.stripHtml(htmlText));

    const direct = this.decodeBase64Url(payload.body?.data);
    return this.normalizeEmailText(payload.mimeType === 'text/html' ? this.stripHtml(direct) : direct);
  }

  private collectBodyParts(part: gmail_v1.Schema$MessagePart, plainParts: string[], htmlParts: string[]) {
    const decoded = this.decodeBase64Url(part.body?.data);
    if (decoded) {
      if (part.mimeType === 'text/plain') plainParts.push(decoded);
      if (part.mimeType === 'text/html') htmlParts.push(decoded);
    }

    for (const child of part.parts ?? []) {
      this.collectBodyParts(child, plainParts, htmlParts);
    }
  }

  private decodeBase64Url(value?: string | null) {
    if (!value) return '';
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
  }

  private stripHtml(value: string) {
    return value
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private normalizeEmailText(value: string) {
    return value.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  private async enqueueGmailIndexingJob(
    tx: any,
    input: {
      userId: string;
      gmailMessageId: string;
      externalId: string;
      subject: string;
    },
  ) {
    const job = await tx.indexingOutbox.upsert({
      where: {
        job_type_source_type_source_id: {
          job_type: 'index_memory',
          source_type: 'gmail',
          source_id: input.gmailMessageId,
        },
      },
      update: {
        user_id: input.userId,
        status: 'pending',
        retry_count: 0,
        error: null,
        payload: {
          externalId: input.externalId,
          sourceTitle: input.subject,
        },
        run_after: new Date(),
        locked_at: null,
        processed_at: null,
      },
      create: {
        user_id: input.userId,
        job_type: 'index_memory',
        source_type: 'gmail',
        source_id: input.gmailMessageId,
        status: 'pending',
        payload: {
          externalId: input.externalId,
          sourceTitle: input.subject,
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
