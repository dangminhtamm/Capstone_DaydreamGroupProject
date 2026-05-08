import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SupabaseStrategy } from './supabase.strategy';
import { AuthController } from './auth.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    providers: [SupabaseStrategy, PrismaService],
    controllers: [AuthController],
    exports: [PassportModule, SupabaseStrategy],
})
export class AuthModule { } 