import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKeyProvider: passportJwtSecret({
                cache: true,
                rateLimit: true,
                jwksRequestsPerMinute: 5,
                jwksUri: `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co/auth/v1/.well-known/jwks.json`,
            }),
            algorithms: ['RS256'],
        });
    }

    async validate(payload: any) {
        // The 'sub' field is the Supabase User UUID
        return { userId: payload.sub, email: payload.email };
    }
}