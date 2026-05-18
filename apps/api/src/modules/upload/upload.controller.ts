// apps/api/src/upload/upload.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createDefaultEmbeddingProvider } from '@second-brain/ai';
import { insertMemoryChunks } from '@second-brain/db';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('attachment')
  @UseInterceptors(FileInterceptor('file')) // 'file' matches the field name in your form-data
  async uploadAttachment(
    @Request() req: { user: { userId: string } },
    @Body('diaryEntryId') diaryEntryId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB limit
          new FileTypeValidator({
            fileType:
              /(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|image\/png|image\/jpeg|text\/plain|text\/markdown|text\/csv|application\/json)/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!diaryEntryId) {
      throw new BadRequestException('diaryEntryId is required.');
    }

    const user = await this.prisma.user.findUnique({
      where: { supabaseId: req.user.userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const diaryEntry = await this.prisma.diaryEntry.findFirst({
      where: {
        id: diaryEntryId,
        user_id: user.id,
      },
      select: { id: true, entry_date: true },
    });

    if (!diaryEntry) {
      throw new NotFoundException('Diary entry not found.');
    }

    const extractedText = this.extractText(file);
    const uploadedFile = await this.storageService.uploadFile(
      file,
      'attachments-bucket',
    );
    const attachment = await this.prisma.attachment.create({
      data: {
        diary_entry_id: diaryEntry.id,
        storage_path: uploadedFile.path,
        file_type: file.mimetype,
        extracted_text: extractedText,
      },
    });
    const indexingResult = await this.indexAttachmentText({
      userId: user.id,
      diaryEntryId: diaryEntry.id,
      diaryEntryDate: diaryEntry.entry_date,
      attachmentId: attachment.id,
      originalName: file.originalname,
      mimeType: file.mimetype,
      storagePath: uploadedFile.path,
      publicUrl: uploadedFile.url,
      extractedText,
    });

    return {
      message: 'Upload successful',
      url: uploadedFile.url,
      extractionStatus: extractedText ? 'extracted' : 'not_supported_or_empty',
      memoryIndexed: indexingResult.indexed,
      memoryError: indexingResult.error,
      attachment: {
        id: attachment.id,
        diaryEntryId: attachment.diary_entry_id,
        storagePath: attachment.storage_path,
        fileType: attachment.file_type,
        extractedText: attachment.extracted_text,
        createdAt: attachment.created_at.toISOString(),
      },
    };
  }

  private extractText(file: Express.Multer.File): string | null {
    try {
      if (this.isTextLike(file.mimetype)) {
        return this.cleanExtractedText(file.buffer.toString('utf8'));
      }

      if (file.mimetype === 'application/pdf') {
        return this.extractTextFromPdfBuffer(file.buffer);
      }

      return null;
    } catch (error) {
      console.warn(
        '[UploadController] Attachment text extraction failed:',
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  private isTextLike(mimeType: string) {
    return mimeType.startsWith('text/') || mimeType === 'application/json';
  }

  private extractTextFromPdfBuffer(buffer: Buffer): string | null {
    const raw = buffer.toString('latin1');
    const matches = [...raw.matchAll(/\(([^()]{3,})\)/g)]
      .map((match) =>
        match[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\n')
          .replace(/\\t/g, ' ')
          .replace(/\\([()\\])/g, '$1'),
      )
      .filter((text) => /[a-zA-Z0-9]/.test(text));

    return this.cleanExtractedText(matches.join(' '));
  }

  private cleanExtractedText(text: string): string | null {
    const cleaned = text
      .replace(/\u0000/g, '')
      .replace(/[^\S\r\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return cleaned.length >= 10 ? cleaned : null;
  }

  private async indexAttachmentText(input: {
    userId: string;
    diaryEntryId: string;
    diaryEntryDate: Date;
    attachmentId: string;
    originalName: string;
    mimeType: string;
    storagePath: string;
    publicUrl: string;
    extractedText: string | null;
  }): Promise<{ indexed: boolean; error?: string }> {
    if (!input.extractedText) {
      return { indexed: false };
    }

    try {
      const embedder = createDefaultEmbeddingProvider();
      const embedding = await embedder.embedDocument(input.extractedText);

      await insertMemoryChunks(this.prisma as any, [
        {
          userId: input.userId,
          sourceType: 'attachment',
          sourceId: input.attachmentId,
          chunkIndex: 0,
          chunkType: 'general_note',
          text: input.extractedText,
          evidence: input.extractedText.slice(0, 500),
          metadata: {
            date: input.diaryEntryDate.toISOString(),
            sourceType: 'attachment',
            sourceId: input.attachmentId,
            sourceTitle: input.originalName,
            sourceUrl: input.publicUrl,
            chunkIndex: 0,
            chunkType: 'general_note',
            tags: ['attachment'],
            diaryEntryId: input.diaryEntryId,
            mimeType: input.mimeType,
            storagePath: input.storagePath,
            importance: 3,
          },
          occurredAt: input.diaryEntryDate,
          embedding,
        },
      ]);

      return { indexed: true };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to index attachment text';
      console.error(
        '[UploadController] Attachment memory indexing failed:',
        error,
      );

      return { indexed: false, error: message };
    }
  }
}
