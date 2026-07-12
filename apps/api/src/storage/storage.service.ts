// apps/api/src/storage/storage.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const ATTACHMENT_BUCKET = 'attachments-bucket';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private supabase: SupabaseClient;
  private bucketReady = new Map<string, boolean>();

  constructor() {
    const supabaseKey =
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!process.env.SUPABASE_URL || !supabaseKey) {
      this.logger.error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY',
      );
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      supabaseKey!,
    );
  }

  async onModuleInit() {
    // Pre-warm the default bucket on startup so uploads don't fail.
    // If this fails (e.g. anon key lacks admin rights), we log a warning
    // but don't crash — the bucket may already exist or be created manually.
    try {
      await this.ensureBucketExists(ATTACHMENT_BUCKET);
    } catch {
      this.logger.warn(
        `Could not auto-create bucket "${ATTACHMENT_BUCKET}" on startup. ` +
          'Please create it manually in the Supabase Dashboard → Storage, ' +
          'or set SUPABASE_SERVICE_KEY to your service_role key.',
      );
    }
  }

  /**
   * Ensures the given Supabase Storage bucket exists.
   * Creates it (public, 5 MB file limit) if it doesn't.
   * Caches the result so only one RPC is made per bucket name.
   */
  private async ensureBucketExists(bucket: string): Promise<void> {
    if (this.bucketReady.get(bucket)) return;

    try {
      const { error } = await this.supabase.storage.getBucket(bucket);

      if (!error) {
        // Bucket exists
        this.logger.log(`Bucket "${bucket}" already exists.`);
        this.bucketReady.set(bucket, true);
        return;
      }

      if (!error.message?.toLowerCase().includes('not found')) {
        // Permission or network error on getBucket — assume bucket exists
        // (anon key can't call getBucket but can still upload to existing buckets)
        this.logger.warn(
          `Cannot verify bucket "${bucket}" (${error.message}). Assuming it exists.`,
        );
        this.bucketReady.set(bucket, true);
        return;
      }

      // Bucket genuinely not found — try to create it
      this.logger.log(`Bucket "${bucket}" not found — creating it now…`);
      const { error: createError } = await this.supabase.storage.createBucket(
        bucket,
        {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024, // 5 MB
          allowedMimeTypes: [
            'image/png',
            'image/jpeg',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
          ],
        },
      );

      if (createError) {
        this.logger.warn(
          `Could not create bucket "${bucket}": ${createError.message}. ` +
            'Create it manually in Supabase Dashboard → Storage.',
        );
        // Still mark as "ready" so we attempt the upload anyway
        this.bucketReady.set(bucket, true);
        return;
      }

      this.logger.log(`Bucket "${bucket}" created successfully.`);
      this.bucketReady.set(bucket, true);
    } catch (err) {
      this.logger.warn(
        `ensureBucketExists("${bucket}") failed: ${err instanceof Error ? err.message : err}. Proceeding anyway.`,
      );
      // Mark as ready so the next upload attempt goes directly to Supabase
      this.bucketReady.set(bucket, true);
    }
  }

  async uploadFile(file: Express.Multer.File, bucket: string) {
    // Guarantee the bucket is there before writing
    await this.ensureBucketExists(bucket);

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
    await this.ensureBucketExists(bucket);

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .download(path);

    if (error) throw error;
    if (!data) throw new Error(`File not found in storage: ${path}`);

    return Buffer.from(await data.arrayBuffer());
  }
}
