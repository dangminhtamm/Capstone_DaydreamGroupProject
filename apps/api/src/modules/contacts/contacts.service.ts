import {
  Injectable,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { google, people_v1 } from 'googleapis';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptOAuthToken, encryptOAuthToken } from '../calendar/oauth-token-crypto';
import { invalidateUserSearchCache } from '../../common/cache/search-answer-cache';
import {
  GOOGLE_SOURCE_SCOPES,
  getAllGoogleWorkspaceScopes,
  getGoogleConnectionStatus,
  recordGoogleSyncFailure,
  recordGoogleSyncSuccess,
  shouldStoreGoogleRawPayloads,
} from '../google-connections/google-connections';

type GoogleContactRow = {
  external_id: string;
  display_name: string;
  email_addresses: string[];
  phone_numbers: string[];
  organizations: string[];
  photo_url: string | null;
  raw_json: people_v1.Schema$Person | null;
};

@Injectable()
export class ContactsService {
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

    if (!user) {
      throw new NotFoundException('User not found');
    }

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

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [contactCount, latestContact] = await Promise.all([
      this.prisma.googleContact.count({
        where: { user_id: user.id },
      }),
      this.prisma.googleContact.findFirst({
        where: { user_id: user.id },
        orderBy: { updated_at: 'desc' },
        select: { updated_at: true },
      }),
    ]);

    const fallbackConnected = user.google_connected && Boolean(user.google_refresh_token || user.google_access_token);
    const connection = await getGoogleConnectionStatus(this.prisma, user.id, 'contact', fallbackConnected);

    return {
      source: 'contact',
      oauthMode: this.getOauthMode(connection.scopes),
      connected: connection.connected && fallbackConnected,
      scopes: connection.scopes,
      requestedScopes: GOOGLE_SOURCE_SCOPES.contact,
      workspaceScopes: getAllGoogleWorkspaceScopes(),
      contactCount,
      lastSyncedAt: connection.lastSyncAt ?? latestContact?.updated_at ?? null,
      lastError: connection.lastError,
      lastErrorAt: connection.lastErrorAt,
      syncCursor: connection.syncCursor,
    };
  }

  async getContactsFromDb(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.googleContact.findMany({
      where: { user_id: user.id },
      select: {
        id: true,
        external_id: true,
        display_name: true,
        email_addresses: true,
        phone_numbers: true,
        organizations: true,
        photo_url: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { display_name: 'asc' },
      take: 50,
    });
  }

  async syncGoogleContacts(supabaseId: string, options: { limit?: number } = {}) {
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

    const people = google.people({ version: 'v1', auth: oauth2Client });
    const maxContacts = Math.min(Math.max(options.limit ?? 500, 1), 1000);
    const pageSize = Math.min(maxContacts, 1000);

    try {
      const normalizedContacts: GoogleContactRow[] = [];
      let pageToken: string | undefined;

      do {
        const response = await people.people.connections.list({
          resourceName: 'people/me',
          personFields: 'metadata,names,emailAddresses,phoneNumbers,organizations,photos',
          pageSize,
          pageToken,
          sortOrder: 'FIRST_NAME_ASCENDING',
        });

        for (const person of response.data.connections ?? []) {
          if (normalizedContacts.length >= maxContacts) break;
          const normalized = this.normalizeContact(person);
          if (normalized) normalizedContacts.push(normalized);
        }

        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken && normalizedContacts.length < maxContacts);

      const queuedIndexingJobs = await this.prisma.$transaction(async (tx) => {
        let queuedCount = 0;

        for (const contact of normalizedContacts) {
          const savedContact = await tx.googleContact.upsert({
            where: {
              user_id_external_id: {
                user_id: user.id,
                external_id: contact.external_id,
              },
            },
            update: {
              display_name: contact.display_name,
              email_addresses: contact.email_addresses,
              phone_numbers: contact.phone_numbers,
              organizations: contact.organizations,
              photo_url: contact.photo_url,
              raw_json: contact.raw_json as any,
            },
            create: {
              user_id: user.id,
              external_id: contact.external_id,
              display_name: contact.display_name,
              email_addresses: contact.email_addresses,
              phone_numbers: contact.phone_numbers,
              organizations: contact.organizations,
              photo_url: contact.photo_url,
              raw_json: contact.raw_json as any,
            },
          });

          await this.enqueueContactIndexingJob(tx, {
            userId: user.id,
            contactId: savedContact.id,
            externalId: savedContact.external_id,
            displayName: savedContact.display_name,
          });
          queuedCount += 1;
        }

        return queuedCount;
      });

      await recordGoogleSyncSuccess(this.prisma, { userId: user.id, source: 'contact' });

      return {
        message: 'Google Contacts synced successfully; contact memory indexing queued.',
        syncedCount: normalizedContacts.length,
        queuedIndexingJobs,
        memoryIndexingStatus: 'queued',
      };
    } catch (error) {
      await recordGoogleSyncFailure(this.prisma, { userId: user.id, source: 'contact', error });
      if (this.isInsufficientScopeError(error)) {
        throw new ForbiddenException('Reconnect Google to grant Contacts permission.');
      }
      console.error('Failed to sync Google Contacts:', error);
      throw new InternalServerErrorException('Could not sync Google Contacts to database');
    }
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

  private normalizeContact(person: people_v1.Schema$Person): GoogleContactRow | null {
    const externalId = person.resourceName;
    if (!externalId) return null;

    const emailAddresses = this.uniqueValues(
      this.compactStrings(person.emailAddresses?.map((email) => email.value) ?? []),
    );
    const phoneNumbers = this.uniqueValues(
      this.compactStrings(person.phoneNumbers?.map((phone) => phone.value) ?? []),
    );
    const organizations = this.uniqueValues(
      this.compactStrings(person.organizations
        ?.flatMap((org) => [org.name, org.title])
        ?? []),
    );
    const displayName =
      person.names?.find((name) => name.displayName)?.displayName ??
      emailAddresses[0] ??
      phoneNumbers[0] ??
      organizations[0] ??
      'Unnamed contact';

    return {
      external_id: externalId,
      display_name: displayName,
      email_addresses: emailAddresses,
      phone_numbers: phoneNumbers,
      organizations,
      photo_url: person.photos?.find((photo) => photo.url)?.url ?? null,
      raw_json: shouldStoreGoogleRawPayloads() ? person : null,
    };
  }

  private getOauthMode(scopes: string[]) {
    const workspaceScopes = getAllGoogleWorkspaceScopes();
    const normalizedScopes = new Set(scopes);
    return workspaceScopes.every((scope) => normalizedScopes.has(scope))
      ? 'all_google_sources'
      : 'source_scoped';
  }

  private uniqueValues(values: string[]) {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  private compactStrings(values: Array<string | null | undefined>) {
    return values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  }

  private async enqueueContactIndexingJob(
    tx: any,
    input: {
      userId: string;
      contactId: string;
      externalId: string;
      displayName: string;
    },
  ) {
    const job = await tx.indexingOutbox.upsert({
      where: {
        job_type_source_type_source_id: {
          job_type: 'index_memory',
          source_type: 'contact',
          source_id: input.contactId,
        },
      },
      update: {
        user_id: input.userId,
        status: 'pending',
        retry_count: 0,
        error: null,
        payload: {
          externalId: input.externalId,
          sourceTitle: input.displayName,
        },
        run_after: new Date(),
        locked_at: null,
        locked_by: null,
        processed_at: null,
      },
      create: {
        user_id: input.userId,
        job_type: 'index_memory',
        source_type: 'contact',
        source_id: input.contactId,
        status: 'pending',
        payload: {
          externalId: input.externalId,
          sourceTitle: input.displayName,
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
}
