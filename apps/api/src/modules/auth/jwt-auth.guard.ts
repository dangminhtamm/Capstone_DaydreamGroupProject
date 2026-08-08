import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    handleRequest<TUser = { userId: string; email: string }>(err: Error | null, user: TUser | false, info: unknown): TUser {
        if (err || !user) {
            if (err) {
                console.warn('[Auth] Supabase JWT validation failed:', err.message);
            } else if (info) {
                const message = typeof info === 'object' && info !== null && 'message' in info
                    ? String((info as { message?: unknown }).message)
                    : String(info);
                console.warn('[Auth] Supabase JWT validation failed:', message);
            }

            throw new UnauthorizedException('Invalid or missing Supabase JWT');
        }

        return user;
    }
}
