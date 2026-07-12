import { prisma } from '../../lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { indexMemoryFromAttachment } from '@second-brain/ai';
import { insertMemoryChunks, pruneMemoryChunksForSource } from '@second-brain/db';
import * as cron from 'node-cron';

export class DataIngestionJob {
  private static getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase URL and Service Key must be set in environment variables.");
    }

    return createClient(supabaseUrl, supabaseKey);
  }

  private static async extractTextFromBlob(base64Data: string, mimeType: string): Promise<string> {
    console.log(`[Worker - Ingestion] Calling Gemini to extract text (MIME: ${mimeType})...`);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing in environment variables.");

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash" });

    const prompt = `
      You are an AI assistant for a personal Second Brain system.
      Extract all readable text, transcripts, or meaningful textual content from this file.
      If it is an image or document, transcribe the text as accurately as possible.
      If it contains no text, provide a brief description of what the image/file contains.
      Do not invent any details. Return only the extracted text or description.
    `;

    try {
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        }
      ]);
      const extractedText = result.response.text();
      console.log(`[Worker - Ingestion] Text extraction successful.`);
      return extractedText;
    } catch (error: any) {
      console.error(`[Worker - Ingestion] Gemini API Error:`, error.message);
      throw error;
    }
  }

  static async processPendingAttachments() {
    console.log(`[Worker - Ingestion] Scanning for pending attachments...`);

    try {
      const pendingAttachments = await prisma.attachment.findMany({
        where: { extracted_text: null },
        include: {
          diary_entry: true
        },
        take: 10 // Batch size to avoid timeouts
      });

      if (pendingAttachments.length === 0) {
        console.log(`[Worker - Ingestion] No pending attachments found.`);
        return;
      }

      console.log(`[Worker - Ingestion] Found ${pendingAttachments.length} attachments to process.`);
      const supabase = this.getSupabaseClient();

      for (const attachment of pendingAttachments) {
        console.log(`[Worker - Ingestion] Processing attachment ${attachment.id} for user ${attachment.diary_entry.user_id}`);

        try {
          // 1. Download file from Supabase Storage
          const { data, error } = await supabase.storage
            .from('attachments-bucket')
            .download(attachment.storage_path);

          if (error || !data) {
            console.error(`[Worker - Ingestion] Failed to download ${attachment.storage_path}:`, error?.message);
            continue;
          }

          // 2. Convert to base64
          const arrayBuffer = await data.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Data = buffer.toString('base64');

          // 3. Extract text using Gemini
          const extractedText = await this.extractTextFromBlob(base64Data, attachment.file_type);

          // 4. Update the Attachment record
          await prisma.attachment.update({
            where: { id: attachment.id },
            data: { extracted_text: extractedText }
          });

          // 5. Index into MemoryChunks as an attachment source linked back to the diary.
          if (extractedText && extractedText.trim().length > 0) {
            const indexingResult = await indexMemoryFromAttachment({
              userId: attachment.diary_entry.user_id,
              attachmentId: attachment.id,
              diaryEntryId: attachment.diary_entry_id,
              extractedText,
              occurredAt: attachment.diary_entry.entry_date,
              sourceTitle: `Attachment: ${attachment.storage_path.split('/').pop()}`,
              fileType: attachment.file_type,
              insertChunks: (chunks) =>
                prisma.$transaction(async (tx: any) => {
                  await insertMemoryChunks(tx, chunks);
                  await pruneMemoryChunksForSource(tx, {
                    userId: attachment.diary_entry.user_id,
                    sourceType: 'attachment',
                    sourceId: attachment.id,
                    keepChunkCount: chunks.length,
                  });
                }),
            });
            console.log(`[Worker - Ingestion] Successfully indexed ${indexingResult.chunkCount} chunks for attachment ${attachment.id}`);
          }

        } catch (innerError: any) {
          console.error(`[Worker - Ingestion] Failed processing attachment ${attachment.id}:`, innerError.message);
        }
      }

    } catch (error) {
      console.error(`[Worker - Ingestion] Pipeline process error:`, error);
    }
  }

  static startCron() {
    // Run every 2 minutes
    cron.schedule('*/2 * * * *', async () => {
      await this.processPendingAttachments();
    });
    console.log('Background Worker for Universal Data Ingestion Pipeline started.');
  }
}
