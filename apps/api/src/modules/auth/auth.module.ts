import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SupabaseStrategy } from './supabase.strategy';
import { AuthController } from './auth.controller';

@Module({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    providers: [SupabaseStrategy],
    controllers: [AuthController],
    exports: [PassportModule, SupabaseStrategy],
})
export class AuthModule { } 