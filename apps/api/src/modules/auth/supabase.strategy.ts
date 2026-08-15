import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import type { Request } from 'express';

type SecretProviderCallback = (err: Error | null, secret?: string | Buffer) => void;
type SecretProvider = (
    request: Request,
    rawJwtToken: string,
    done: SecretProviderCallback,
) => void;

type SupabaseJwtPayload = {
    sub?: unknown;
    email?: unknown;
    email_verified?: unknown;
    email_confirmed_at?: unknown;
    confirmed_at?: unknown;
    user_metadata?: unknown;
    app_metadata?: unknown;
};

type SupabaseJwtConfig = {
    issuer: string | string[];
    audience: string | string[];
    jwksUri?: string;
};

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy) {
    constructor() {
        const jwtConfig = getSupabaseJwtConfig();

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKeyProvider: createSupabaseSecretProvider(jwtConfig),
            algorithms: ['HS256', 'ES256'],
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience,
        });
    }

    async validate(payload: SupabaseJwtPayload) {
        const userId = getRequiredStringClaim(payload.sub, 'sub');
        const email = getRequiredStringClaim(payload.email, 'email');
        const emailVerified = isSupabaseEmailVerified(payload);

        if (emailVerificationRequired() && !emailVerified) {
            throw new UnauthorizedException('Supabase email must be verified.');
        }

        return { userId, email, emailVerified };
    }
}

function createSupabaseSecretProvider(config: SupabaseJwtConfig): SecretProvider {
    let jwksSecretProvider: SecretProvider | null = null;

    return (request, rawJwtToken, done) => {
        const algorithm = getJwtAlgorithm(rawJwtToken);

        if (algorithm === 'HS256') {
            const jwtSecret = process.env.SUPABASE_JWT_SECRET?.trim();
            if (!jwtSecret) {
                done(new Error('SUPABASE_JWT_SECRET is required to validate HS256 Supabase JWTs.'));
                return;
            }

            done(null, jwtSecret);
            return;
        }

        if (algorithm === 'ES256') {
            if (!config.jwksUri) {
                done(new Error('SUPABASE_PROJECT_ID, SUPABASE_URL, or SUPABASE_JWKS_URL is required to validate ES256 Supabase JWTs.'));
                return;
            }

            jwksSecretProvider ??= passportJwtSecret({
                cache: true,
                rateLimit: true,
                jwksRequestsPerMinute: 5,
                jwksUri: config.jwksUri,
            }) as SecretProvider;
            jwksSecretProvider(request, rawJwtToken, done);
            return;
        }

        done(new Error(`Unsupported Supabase JWT algorithm: ${algorithm || 'missing'}.`));
    };
}

function getSupabaseJwtConfig(): SupabaseJwtConfig {
    const projectId =
        process.env.SUPABASE_PROJECT_ID?.trim() ||
        getProjectIdFromSupabaseUrl(process.env.SUPABASE_URL);
    const issuerValues =
        parseCsvEnv(process.env.SUPABASE_JWT_ISSUER) ??
        (projectId ? [`https://${projectId}.supabase.co/auth/v1`] : null);

    if (!issuerValues?.length) {
        throw new Error('SUPABASE_PROJECT_ID, SUPABASE_URL, or SUPABASE_JWT_ISSUER is required to validate Supabase JWT issuer.');
    }

    const audienceValues =
        parseCsvEnv(process.env.SUPABASE_JWT_AUDIENCE) ??
        ['authenticated'];
    const jwksUri =
        process.env.SUPABASE_JWKS_URL?.trim() ||
        (projectId ? `https://${projectId}.supabase.co/auth/v1/.well-known/jwks.json` : undefined);

    return {
        issuer: oneOrMany(issuerValues),
        audience: oneOrMany(audienceValues),
        jwksUri,
    };
}

function getProjectIdFromSupabaseUrl(value: string | undefined) {
    if (!value) return undefined;

    try {
        const host = new URL(value).host;
        const match = /^([a-z0-9-]+)\.supabase\.co$/i.exec(host);
        return match?.[1];
    } catch {
        return undefined;
    }
}

function parseCsvEnv(value: string | undefined) {
    const values = value
        ?.split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    return values?.length ? values : null;
}

function oneOrMany(values: string[]) {
    return values.length === 1 ? values[0] : values;
}

function getRequiredStringClaim(value: unknown, name: string) {
    if (typeof value === 'string' && value.trim()) {
        return value.trim();
    }

    throw new UnauthorizedException(`Supabase JWT ${name} claim is required.`);
}

function emailVerificationRequired() {
    const configured = process.env.AUTH_REQUIRE_EMAIL_VERIFIED;
    if (configured !== undefined) {
        return configured.toLowerCase() !== 'false';
    }

    return process.env.NODE_ENV === 'production';
}

function isSupabaseEmailVerified(payload: SupabaseJwtPayload) {
    return (
        payload.email_verified === true ||
        hasTruthyBooleanClaim(payload.user_metadata, 'email_verified') ||
        hasTruthyBooleanClaim(payload.app_metadata, 'email_verified') ||
        hasNonEmptyStringClaim(payload, 'email_confirmed_at') ||
        hasNonEmptyStringClaim(payload, 'confirmed_at')
    );
}

function hasTruthyBooleanClaim(value: unknown, key: string) {
    return Boolean(
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        (value as Record<string, unknown>)[key] === true,
    );
}

function hasNonEmptyStringClaim(value: Record<string, unknown>, key: string) {
    const claim = value[key];
    return typeof claim === 'string' && claim.trim().length > 0;
}

function getJwtAlgorithm(rawJwtToken: string): string | undefined {
    const [encodedHeader] = rawJwtToken.split('.');
    if (!encodedHeader) return undefined;

    try {
        const header = JSON.parse(Buffer.from(toBase64(encodedHeader), 'base64').toString('utf8')) as {
            alg?: unknown;
        };
        return typeof header.alg === 'string' ? header.alg : undefined;
    } catch {
        return undefined;
    }
}

function toBase64(base64Url: string): string {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    return padding ? `${base64}${'='.repeat(4 - padding)}` : base64;
}
