import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@second-brain/db'; // Your generated client package

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    // This ensures that when the Nest.js app starts,
    // it immediately establishes a connection to Supabase.
    await this.$connect();
  }
}
