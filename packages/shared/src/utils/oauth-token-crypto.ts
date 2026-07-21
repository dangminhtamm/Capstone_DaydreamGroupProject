import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';

function getKey() {
  const raw =
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ??
    process.env.TOKEN_ENCRYPTION_KEY ??
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY is required in production.');
    }
    return null;
  }

  const base64 = Buffer.from(raw, 'base64');
  if (base64.length === 32) return base64;

  return createHash('sha256').update(raw).digest();
}

export function encryptOAuthToken(token: string | null | undefined) {
  if (!token) return token ?? null;
  if (token.startsWith(PREFIX)) return token;

  const key = getKey();
  if (!key) return token;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString('base64url'),
    '.',
    tag.toString('base64url'),
    '.',
    ciphertext.toString('base64url'),
  ].join('');
}

export function decryptOAuthToken(token: string | null | undefined) {
  if (!token) return token ?? null;
  if (!token.startsWith(PREFIX)) return token;

  const key = getKey();
  if (!key) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY is required to decrypt OAuth tokens.');
  }

  const [ivText, tagText, ciphertextText] = token.slice(PREFIX.length).split('.');
  if (!ivText || !tagText || !ciphertextText) {
    throw new Error('Invalid encrypted OAuth token format.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivText, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
