import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy) {
    constructor() {
        const projectId = process.env.SUPABASE_PROJECT_ID || 'iqbempcnkkggjejegziw';

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKeyProvider: passportJwtSecret({
                cache: true,
                rateLimit: true,
                jwksRequestsPerMinute: 5,
                jwksUri: `https://${projectId}.supabase.co/auth/v1/.well-known/jwks.json`,
            }),
            algorithms: ['ES256'],
        });
    }

    async validate(payload: any) {
        return { userId: payload.sub, email: payload.email };
    }
}