// apps/api/src/storage/storage.service.ts
import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  async uploadFile(file: Express.Multer.File, bucket: string) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `attachments/${Date.now()}-${safeName}`;

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) throw error;

    // Get the public URL to store in your database via Prisma
    const { data: urlData } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      path: data.path,
      url: urlData.publicUrl,
    };
  }

  async downloadFile(bucket: string, path: string) {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .download(path);

    if (error) throw error;
    if (!data) throw new Error(`File not found in storage: ${path}`);

    return Buffer.from(await data.arrayBuffer());
  }
}
