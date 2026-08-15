import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { gmail_v1, google } from 'googleapis';
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

type GmailMessageRow = {
  external_id: string;
  thread_id: string | null;
  sender: string;
  subject: string;
  snippet: string | null;
  body: string;
  received_at: Date | null;
  raw_json: gmail_v1.Schema$Message | null;
};

type GoogleUserWithTokens = {
  id: string;
  google_access_token: string | null;
  google_refresh_token: string | null;
};

type GmailClientContext = {
  user: GoogleUserWithTokens;
  gmail: gmail_v1.Gmail;
};

type GoogleApiErrorDetails = {
  status?: number;
  reason?: string;
  message: string;
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

    let messageCount = 0;
    let latestMessage: { updated_at: Date; received_at: Date | null } | null = null;
    try {
      [messageCount, latestMessage] = await Promise.all([
        this.prisma.gmailMessage.count({ where: { user_id: user.id } }),
        this.prisma.gmailMessage.findFirst({
          where: { user_id: user.id },
          orderBy: [{ received_at: 'desc' }, { updated_at: 'desc' }],
          select: { updated_at: true, received_at: true },
        }),
      ]);
    } catch (error) {
      this.throwGmailDatabaseException(error, 'Could not load Gmail status from database.');
    }

    const fallbackConnected = user.google_connected && Boolean(user.google_refresh_token || user.google_access_token);
    const connection = await getGoogleConnectionStatus(this.prisma, user.id, 'gmail', fallbackConnected);

    return {
      source: 'gmail',
      oauthMode: this.getOauthMode(connection.scopes),
      connected: connection.connected && fallbackConnected,
      scopes: connection.scopes,
      requestedScopes: GOOGLE_SOURCE_SCOPES.gmail,
      workspaceScopes: getAllGoogleWorkspaceScopes(),
      messageCount,
      lastSyncedAt: connection.lastSyncAt ?? latestMessage?.updated_at ?? latestMessage?.received_at ?? null,
      lastError: connection.lastError,
      lastErrorAt: connection.lastErrorAt,
      syncCursor: connection.syncCursor,
    };
  }

  async getMessagesFromDb(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('User not found');

    try {
      return await this.prisma.gmailMessage.findMany({
        where: { user_id: user.id },
        select: {
          id: true,
          external_id: true,
          thread_id: true,
          sender: true,
          subject: true,
          snippet: true,
          received_at: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: [{ received_at: 'desc' }, { updated_at: 'desc' }],
        take: 50,
      });
    } catch (error) {
      this.throwGmailDatabaseException(error, 'Could not load Gmail messages from database.');
    }
  }

  async listImportCandidates(supabaseId: string, options: { limit?: number; query?: string } = {}) {
    const { user, gmail } = await this.getGmailClientContext(supabaseId);
    const maxMessages = Math.min(Math.max(options.limit ?? 20, 1), 50);

    try {
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: maxMessages,
        q: this.buildGmailSearchQuery(options.query),
      });
      const messageRefs = listResponse.data.messages ?? [];
      const metadataMessages: gmail_v1.Schema$Message[] = [];

      for (const ref of messageRefs) {
        if (!ref.id) continue;
        const response = await gmail.users.messages.get({
          userId: 'me',
          id: ref.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        metadataMessages.push(response.data);
      }

      const externalIds = metadataMessages.map((message) => message.id).filter((id): id is string => Boolean(id));
      const importedIds = externalIds.length
        ? await this.prisma.gmailMessage.findMany({
            where: {
              user_id: user.id,
              external_id: { in: externalIds },
            },
            select: { external_id: true },
          })
        : [];
      const importedSet = new Set(importedIds.map((message) => message.external_id));

      return {
        message: 'Gmail import candidates fetched successfully.',
        count: metadataMessages.length,
        candidates: metadataMessages
          .filter((message) => message.id)
          .map((message) => this.toCandidate(message, importedSet.has(message.id!))),
      };
    } catch (error) {
      await recordGoogleSyncFailure(this.prisma, { userId: user.id, source: 'gmail', error });
      this.throwGoogleApiException(error);
      console.error('Failed to list Gmail import candidates:', this.getSafeErrorContext(error));
      throw new InternalServerErrorException('Could not list Gmail messages for import.');
    }
  }

  async importSelectedMessages(supabaseId: string, messageIds: string[]) {
    const { user, gmail } = await this.getGmailClientContext(supabaseId);
    const selectedIds = this.normalizeSelectedIds(messageIds, 50);

    try {
      const normalizedMessages: GmailMessageRow[] = [];
      for (const messageId of selectedIds) {
        const response = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        });
        const normalized = this.normalizeMessage(response.data);
        if (normalized) normalizedMessages.push(normalized);
      }

      const queuedIndexingJobs = await this.saveMessagesAndQueueIndexing(user.id, normalizedMessages);
      await recordGoogleSyncSuccess(this.prisma, { userId: user.id, source: 'gmail' });

      return {
        message: 'Selected Gmail messages imported; Gmail memory indexing queued.',
        syncedCount: normalizedMessages.length,
        requestedCount: selectedIds.length,
        queuedIndexingJobs,
        memoryIndexingStatus: 'queued',
      };
    } catch (error) {
      await recordGoogleSyncFailure(this.prisma, { userId: user.id, source: 'gmail', error });
      this.throwGoogleApiException(error);
      this.throwGmailDatabaseException(error, 'Could not import selected Gmail messages.');
      console.error('Failed to import selected Gmail messages:', this.getSafeErrorContext(error));
      throw new InternalServerErrorException('Could not import selected Gmail messages. Check API logs for details.');
    }
  }

  async syncGmailMessages(supabaseId: string, options: { limit?: number } = {}) {
    const { user, gmail } = await this.getGmailClientContext(supabaseId);
    const maxMessages = Math.min(Math.max(options.limit ?? 25, 1), 100);

    try {
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: maxMessages,
        q: this.buildGmailSearchQuery(),
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

      const queuedIndexingJobs = await this.saveMessagesAndQueueIndexing(user.id, normalizedMessages);

      await recordGoogleSyncSuccess(this.prisma, { userId: user.id, source: 'gmail' });

      return {
        message: 'Gmail messages synced successfully; Gmail memory indexing queued.',
        syncedCount: normalizedMessages.length,
        queuedIndexingJobs,
        memoryIndexingStatus: 'queued',
      };
    } catch (error) {
      await recordGoogleSyncFailure(this.prisma, { userId: user.id, source: 'gmail', error });
      this.throwGoogleApiException(error);
      this.throwGmailDatabaseException(error, 'Could not sync Gmail messages to database.');
      console.error('Failed to sync Gmail messages:', this.getSafeErrorContext(error));
      throw new InternalServerErrorException('Could not sync Gmail messages. Check API logs for details.');
    }
  }

  private async getGmailClientContext(supabaseId: string): Promise<GmailClientContext> {
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
    return { user, gmail };
  }

  private buildGmailSearchQuery(query?: string) {
    const normalizedQuery = query?.trim();
    return [normalizedQuery, 'newer_than:365d', '-in:spam', '-in:trash']
      .filter((part): part is string => Boolean(part))
      .join(' ');
  }

  private normalizeSelectedIds(messageIds: string[], maxItems: number) {
    return Array.from(new Set(messageIds.map((id) => id.trim()).filter(Boolean))).slice(0, maxItems);
  }

  private toCandidate(message: gmail_v1.Schema$Message, alreadyImported: boolean) {
    const headers = message.payload?.headers ?? [];
    const headerDate = this.getHeader(headers, 'Date');
    const internalDate = message.internalDate ? Number(message.internalDate) : NaN;
    const receivedAt = Number.isFinite(internalDate)
      ? new Date(internalDate)
      : headerDate
        ? new Date(headerDate)
        : null;

    return {
      id: message.id!,
      threadId: message.threadId ?? null,
      sender: this.sanitizePostgresText(this.getHeader(headers, 'From') || 'Unknown sender'),
      subject: this.sanitizePostgresText(this.getHeader(headers, 'Subject') || '(no subject)'),
      snippet: message.snippet ? this.sanitizePostgresText(message.snippet) : null,
      receivedAt: receivedAt && Number.isFinite(receivedAt.getTime()) ? receivedAt.toISOString() : null,
      alreadyImported,
    };
  }

  private async saveMessagesAndQueueIndexing(userId: string, messages: GmailMessageRow[]) {
    return this.prisma.$transaction(async (tx) => {
      let queuedCount = 0;

      for (const message of messages) {
        const savedMessage = await tx.gmailMessage.upsert({
          where: {
            user_id_external_id: {
              user_id: userId,
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
            user_id: userId,
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
          userId,
          gmailMessageId: savedMessage.id,
          externalId: savedMessage.external_id,
          subject: savedMessage.subject,
        });
        queuedCount += 1;
      }

      return queuedCount;
    });
  }

  private normalizeMessage(message: gmail_v1.Schema$Message): GmailMessageRow | null {
    if (!message.id) return null;

    const headers = message.payload?.headers ?? [];
    const sender = this.sanitizePostgresText(this.getHeader(headers, 'From') || 'Unknown sender');
    const subject = this.sanitizePostgresText(this.getHeader(headers, 'Subject') || '(no subject)');
    const headerDate = this.getHeader(headers, 'Date');
    const internalDate = message.internalDate ? Number(message.internalDate) : NaN;
    const receivedAt = Number.isFinite(internalDate)
      ? new Date(internalDate)
      : headerDate
        ? new Date(headerDate)
        : null;
    const body = this.limitStoredBody(
      this.sanitizePostgresText(this.extractBody(message.payload) || message.snippet || ''),
    );

    return {
      external_id: message.id,
      thread_id: message.threadId ?? null,
      sender,
      subject,
      snippet: message.snippet ? this.sanitizePostgresText(message.snippet) : null,
      body,
      received_at: receivedAt && Number.isFinite(receivedAt.getTime()) ? receivedAt : null,
      raw_json: shouldStoreGoogleRawPayloads()
        ? this.sanitizeJsonValue(message) as gmail_v1.Schema$Message
        : null,
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

  private sanitizePostgresText(value: string) {
    return value.replace(/\u0000/g, '');
  }

  private sanitizeJsonValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private limitStoredBody(value: string) {
    const maxChars = Number(process.env.GOOGLE_GMAIL_BODY_MAX_CHARS ?? 20_000);
    if (!Number.isFinite(maxChars) || maxChars <= 0) return value;
    return value.length > maxChars ? value.slice(0, maxChars).trimEnd() : value;
  }

  private getOauthMode(scopes: string[]) {
    const workspaceScopes = getAllGoogleWorkspaceScopes();
    const normalizedScopes = new Set(scopes);
    return workspaceScopes.every((scope) => normalizedScopes.has(scope))
      ? 'all_google_sources'
      : 'source_scoped';
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
        locked_by: null,
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

  private throwGoogleApiException(error: unknown): never | void {
    const details = this.getGoogleApiErrorDetails(error);
    const message = details.message.toLowerCase();
    const reason = details.reason?.toLowerCase() ?? '';

    if (
      details.status === 401 ||
      details.status === 400 && (message.includes('invalid_grant') || message.includes('token')) ||
      message.includes('token has been expired') ||
      message.includes('token has been revoked')
    ) {
      throw new UnauthorizedException('Google token expired or was revoked. Reconnect Google, then sync Gmail again.');
    }

    if (
      details.status === 403 &&
      (message.includes('gmail api has not been used') ||
        message.includes('api has not been used') ||
        message.includes('disabled') ||
        reason.includes('accessnotconfigured'))
    ) {
      throw new ServiceUnavailableException('Gmail API is not enabled for this Google Cloud project. Enable Gmail API, then reconnect Google.');
    }

    if (
      details.status === 403 ||
      message.includes('insufficient') ||
      message.includes('permission') ||
      message.includes('scope')
    ) {
      throw new ForbiddenException('Reconnect Google to grant Gmail permission.');
    }

    if (
      details.status === 429 ||
      message.includes('quota') ||
      message.includes('rate limit') ||
      reason.includes('ratelimitexceeded')
    ) {
      throw new HttpException('Gmail API quota or rate limit was reached. Wait a bit, then sync Gmail again.', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (details.status === 400) {
      throw new BadRequestException('Gmail sync request was rejected by Google. Reconnect Google, then try again.');
    }
  }

  private throwGmailDatabaseException(error: unknown, fallbackMessage: string): never {
    if (this.isMissingGmailDatabaseShapeError(error)) {
      throw new ServiceUnavailableException('Gmail database table or columns are missing. Apply Prisma migrations, then restart the API.');
    }

    console.error(fallbackMessage, this.getSafeErrorContext(error));
    throw new InternalServerErrorException(fallbackMessage);
  }

  private isMissingGmailDatabaseShapeError(error: unknown) {
    const maybeError = error as {
      code?: string;
      meta?: unknown;
      message?: string;
    };
    const message = `${maybeError.message ?? ''} ${JSON.stringify(maybeError.meta ?? {})}`.toLowerCase();

    return (
      maybeError.code === 'P2021' ||
      maybeError.code === 'P2022' ||
      (message.includes('gmail_messages') &&
        (message.includes('does not exist') ||
          message.includes('not exist') ||
          message.includes('missing') ||
          message.includes('column')))
    );
  }

  private getGoogleApiErrorDetails(error: unknown): GoogleApiErrorDetails {
    const maybeError = error as {
      code?: number | string;
      response?: {
        status?: number;
        data?: unknown;
      };
      message?: string;
    };
    const data = maybeError.response?.data as {
      error?: {
        code?: number;
        message?: string;
        status?: string;
        errors?: Array<{ reason?: string; message?: string }>;
      } | string;
      error_description?: string;
      message?: string;
      code?: number;
    } | undefined;
    const nestedError = data?.error;
    const nestedErrorObject =
      nestedError && typeof nestedError === 'object' ? nestedError : undefined;
    const firstNestedReason = nestedErrorObject?.errors?.find((item) => item.reason)?.reason;
    const firstNestedMessage = nestedErrorObject?.errors?.find((item) => item.message)?.message;
    const status =
      this.toStatusCode(maybeError.response?.status) ??
      this.toStatusCode(nestedErrorObject?.code) ??
      this.toStatusCode(data?.code) ??
      this.toStatusCode(maybeError.code);
    const message = [
      maybeError.message,
      typeof nestedError === 'string' ? nestedError : nestedErrorObject?.message,
      firstNestedMessage,
      data?.error_description,
      data?.message,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ');

    return {
      status,
      reason: firstNestedReason ?? nestedErrorObject?.status,
      message,
    };
  }

  private toStatusCode(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
    return undefined;
  }

  private getSafeErrorContext(error: unknown) {
    const details = this.getGoogleApiErrorDetails(error);
    const maybeError = error as {
      code?: string | number;
      meta?: unknown;
      message?: string;
    };

    return {
      code: maybeError.code,
      prismaMeta: maybeError.meta,
      googleStatus: details.status,
      googleReason: details.reason,
      message: details.message || maybeError.message,
    };
  }
}
