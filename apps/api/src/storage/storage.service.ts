// apps/api/src/storage/storage.service.ts
import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase = createClient(
    process.env.DATABASE_URL, // e.g., https://your-id.supabase.co
    process.env.SECRET_KEY, // Your whitelisted secret key
  );

  async uploadFile(file: Express.Multer.File, bucket: string) {
    const filePath = `attachments/${Date.now()}-${file.originalname}`;

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

    return urlData.publicUrl;
  }
}
