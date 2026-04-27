import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SupabaseStrategy } from './supabase.strategy';
import { AuthController } from './auth.controller';

@Module({
    imports: [PassportModule.register({
        defaultStrategy: 'jwt', secret: 'FO6T6VOWE7clpxVYykcgjZh2DUEocm4jTmgvISjVw4P+caRtuW6mybx9uKxgKzCSloyCa28nuTbv/RlWBZU9+Q==',
        signOptions: { expiresIn: '1h' }
    }
    )],
    providers: [SupabaseStrategy],
    controllers: [AuthController],
    exports: [PassportModule, SupabaseStrategy],
})
export class AuthModule { } 