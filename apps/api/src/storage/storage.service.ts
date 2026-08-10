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
      process.env.SUPABASE_SERVICE_KEY ??
      process.env.SUPABASE_SECRET_KEY ??
      process.env.SECRET_KEY;

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

  private async ensureBucketExists(bucket: string) {
    const supabase = this.getSupabaseClient();
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (buckets && buckets.some((b) => b.name === bucket)) {
        return;
      }
      await supabase.storage.createBucket(bucket, { public: false });
    } catch (err) {
      console.warn(`[StorageService] Auto-create bucket '${bucket}' note:`, err);
    }
  }

  async uploadFile(file: Express.Multer.File, bucket: string, userId: string) {
    const supabase = this.getSupabaseClient();
    await this.ensureBucketExists(bucket);

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `attachments/${userId}/${randomUUID()}-${safeName}`;

    let result = await supabase.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (result.error && (result.error as any).statusCode === '404') {
      await this.ensureBucketExists(bucket);
      result = await supabase.storage
        .from(bucket)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });
    }

    if (result.error) {
      console.error('[StorageService] Upload error:', result.error);
      throw new InternalServerErrorException(
        `Failed to upload file to storage: ${result.error.message}`,
      );
    }

    return {
      path: result.data.path,
    };
  }

  async createSignedUrl(bucket: string, path: string, expiresInSeconds = 300) {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      console.error('[StorageService] createSignedUrl error:', error);
      throw error;
    }
    return data.signedUrl;
  }

  async downloadFile(bucket: string, path: string) {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) {
      console.error('[StorageService] downloadFile error:', error);
      throw error;
    }
    if (!data) throw new Error(`File not found in storage: ${path}`);

    return Buffer.from(await data.arrayBuffer());
  }

  async deleteFile(bucket: string, path: string) {
    const supabase = this.getSupabaseClient();
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      console.error('[StorageService] deleteFile error:', error);
      throw error;
    }
  }
}

