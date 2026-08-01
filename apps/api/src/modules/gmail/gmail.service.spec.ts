import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { GmailService } from './gmail.service';

describe('GmailService error handling', () => {
  let service: GmailService;

  beforeEach(() => {
    service = new GmailService({} as any);
  });

  it('maps missing Gmail table errors to a useful migration message', () => {
    expect(() =>
      (service as any).throwGmailDatabaseException(
        { code: 'P2021', meta: { table: 'gmail_messages' } },
        'Could not load Gmail status from database.',
      ),
    ).toThrow(ServiceUnavailableException);
  });

  it('maps missing Gmail scope errors to reconnect guidance', () => {
    expect(() =>
      (service as any).throwGoogleApiException({
        response: {
          status: 403,
          data: {
            error: {
              message: 'Request had insufficient authentication scopes.',
              errors: [{ reason: 'insufficientPermissions' }],
            },
          },
        },
      }),
    ).toThrow(ForbiddenException);
  });

  it('maps disabled Gmail API errors to an enable-API message', () => {
    expect(() =>
      (service as any).throwGoogleApiException({
        response: {
          status: 403,
          data: {
            error: {
              message: 'Gmail API has not been used in project before or it is disabled.',
              errors: [{ reason: 'accessNotConfigured' }],
            },
          },
        },
      }),
    ).toThrow(ServiceUnavailableException);
  });

  it('maps revoked Google tokens to reconnect guidance', () => {
    expect(() =>
      (service as any).throwGoogleApiException({
        response: {
          status: 401,
          data: {
            error: {
              message: 'Invalid Credentials',
            },
          },
        },
      }),
    ).toThrow(UnauthorizedException);
  });

  it('normalizes Gmail messages into Postgres-safe text and JSON', () => {
    const bodyWithNullByte = Buffer.from('Hello\u0000Second Brain').toString('base64url');
    const message = {
      id: 'gmail-message-1',
      threadId: 'thread-1',
      snippet: 'Snippet\u0000text',
      internalDate: String(Date.UTC(2026, 6, 26)),
      payload: {
        headers: [
          { name: 'From', value: 'Linh\u0000 Mentor <linh@example.com>' },
          { name: 'Subject', value: 'Citation\u0000 feedback' },
        ],
        mimeType: 'text/plain',
        body: { data: bodyWithNullByte },
        undefinedField: undefined,
      },
    };

    const normalized = (service as any).normalizeMessage(message);

    expect(normalized.sender).toBe('Linh Mentor <linh@example.com>');
    expect(normalized.subject).toBe('Citation feedback');
    expect(normalized.snippet).toBe('Snippettext');
    expect(normalized.body).toBe('HelloSecond Brain');
    expect(JSON.stringify(normalized.raw_json)).not.toContain('undefinedField');
  });
});
