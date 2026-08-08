import { Injectable } from '@nestjs/common';
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

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy) {
    constructor() {
        const projectId = process.env.SUPABASE_PROJECT_ID || 'iqbempcnkkggjejegziw';

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKeyProvider: createSupabaseSecretProvider(projectId),
            algorithms: ['HS256', 'ES256'],
        });
    }

    async validate(payload: any) {
        return { userId: payload.sub, email: payload.email };
    }
}

export function createSupabaseSecretProvider(projectId: string): SecretProvider {
    const jwksSecretProvider = passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${projectId}.supabase.co/auth/v1/.well-known/jwks.json`,
    }) as SecretProvider;

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
            jwksSecretProvider(request, rawJwtToken, done);
            return;
        }

        done(new Error(`Unsupported Supabase JWT algorithm: ${algorithm || 'missing'}.`));
    };
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
