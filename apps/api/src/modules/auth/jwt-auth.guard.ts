import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    handleRequest<TUser = { userId: string; email: string }>(err: Error | null, user: TUser | false, info: unknown): TUser {
        if (err || !user) {
            throw err || new UnauthorizedException('Invalid or missing Supabase JWT');
        }

        return user;
    }
}