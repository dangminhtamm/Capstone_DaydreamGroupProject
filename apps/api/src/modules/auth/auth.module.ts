import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SupabaseStrategy } from './supabase.strategy';
import { AuthController } from './auth.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminGuard } from './admin.guard';

@Module({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    providers: [SupabaseStrategy, PrismaService, AdminGuard],
    controllers: [AuthController],
    exports: [PassportModule, SupabaseStrategy, AdminGuard],
})
export class AuthModule { }
