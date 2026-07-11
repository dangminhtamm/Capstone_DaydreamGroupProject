// apps/api/src/storage/storage.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase?: SupabaseClient;

  private getSupabaseClient() {
    if (this.supabase) {
      return this.supabase;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SECRET_KEY ??
      process.env.SECRET_KEY ??
      process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new InternalServerErrorException(
        'Attachment storage is not configured. Set SUPABASE_URL and a server-side Supabase key.',
      );
    }

    if (supabaseKey.startsWith('sb_publishable')) {
      throw new InternalServerErrorException(
        'Attachment storage is using a publishable Supabase key. Set SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, or SECRET_KEY to a server-side key.',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    return this.supabase;
  }

  async uploadFile(file: Express.Multer.File, bucket: string) {
    const supabase = this.getSupabaseClient();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `attachments/${randomUUID()}-${safeName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) throw error;

    return {
      path: data.path,
    };
  }

  async downloadFile(bucket: string, path: string) {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) throw error;
    if (!data) throw new Error(`File not found in storage: ${path}`);

    return Buffer.from(await data.arrayBuffer());
  }

  async deleteFile(bucket: string, path: string) {
    const supabase = this.getSupabaseClient();
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  }
}
