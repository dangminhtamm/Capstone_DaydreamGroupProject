// apps/api/src/upload/upload.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
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
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { invalidateUserSearchCache } from '../../common/cache/search-answer-cache';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('attachment')
  async listAttachments(@Request() req: { user: { userId: string } }) {
    const user = await this.findUserOrThrow(req.user.userId);
    const attachments = await this.prisma.attachment.findMany({
      where: {
        diary_entry: {
          user_id: user.id,
        },
      },
      include: {
        diary_entry: {
          select: {
            id: true,
            entry_date: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    return {
      message: 'Use POST /api/upload/attachment to upload a diary attachment.',
      count: attachments.length,
      attachments: await Promise.all(
        attachments.map((attachment) => this.toClientAttachment(attachment)),
      ),
    };
  }

  @Get('attachment/:id')
  async findAttachment(
    @Request() req: { user: { userId: string } },
    @Param('id') attachmentId: string,
  ) {
    const user = await this.findUserOrThrow(req.user.userId);
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        diary_entry: {
          user_id: user.id,
        },
      },
      include: {
        diary_entry: {
          select: {
            id: true,
            entry_date: true,
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found.');
    }

    return this.toClientAttachment(attachment);
  }

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
            fileType: /^(image\/png|image\/jpe?g|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/plain)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!diaryEntryId) {
      throw new BadRequestException('diaryEntryId is required.');
    }

    const user = await this.findUserOrThrow(req.user.userId);

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

    const uploadedFile = await this.storageService.uploadFile(
      file,
      'attachments-bucket',
      user.id,
    );

    const extractedText = this.extractPlainText(file);

    let attachment: any;
    try {
      attachment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.attachment.create({
          data: {
            diary_entry_id: diaryEntry.id,
            storage_path: uploadedFile.path,
            file_type: file.mimetype,
            ...(extractedText && { extracted_text: extractedText }),
          },
        });

        await this.enqueueAttachmentIndexingJob(tx, {
          userId: user.id,
          attachmentId: created.id,
          sourceTitle: file.originalname,
        });

        return created;
      });
    } catch (error) {
      await this.storageService
        .deleteFile('attachments-bucket', uploadedFile.path)
        .catch((deleteError) => {
          console.error('Failed to remove orphaned uploaded file:', deleteError);
        });
      throw error;
    }

    return {
      message: 'Upload successful',
      extractionStatus: extractedText ? 'extracted' : 'pending',
      memoryIndexed: false,
      memoryIndexingStatus: 'queued',
      memoryChunkCount: 0,
      attachment: await this.toClientAttachment(attachment),
    };
  }

  @Post('attachment/:id/process')
  async processAttachmentNow(
    @Request() req: { user: { userId: string } },
    @Param('id') attachmentId: string,
  ) {
    const user = await this.findUserOrThrow(req.user.userId);

    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        diary_entry: {
          user_id: user.id,
        },
      },
      include: {
        diary_entry: {
          select: {
            id: true,
            entry_date: true,
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found.');
    }

    await this.enqueueAttachmentIndexingJob(this.prisma, {
      userId: user.id,
      attachmentId: attachment.id,
      sourceTitle: this.getStoredFileName(attachment.storage_path),
    });

    return {
      message: 'Attachment processing queued',
      extractionStatus: attachment.extracted_text ? 'extracted' : 'pending',
      memoryIndexed: false,
      memoryIndexingStatus: 'queued',
      memoryChunkCount: 0,
      attachment: await this.toClientAttachment(attachment),
    };
  }

  @Delete('attachment/:id')
  async deleteAttachment(
    @Request() req: { user: { userId: string } },
    @Param('id') attachmentId: string,
  ) {
    const user = await this.findUserOrThrow(req.user.userId);

    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        diary_entry: { user_id: user.id },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found.');
    }

    // Delete from Supabase Storage first
    await this.storageService
      .deleteFile('attachments-bucket', attachment.storage_path)
      .catch((err) => console.warn('Failed to delete file from storage (non-fatal):', err));

    // Delete memory chunks for this attachment
    await this.prisma.memoryChunk.deleteMany({
      where: {
        userId: user.id,
        sourceType: 'attachment',
        sourceId: attachment.id,
      },
    }).catch(() => { /* non-fatal */ });

    // Delete indexing outbox jobs
    await this.prisma.indexingOutbox.deleteMany({
      where: {
        source_type: 'attachment',
        source_id: attachment.id,
      },
    }).catch(() => { /* non-fatal */ });

    // Delete the DB record
    await this.prisma.attachment.delete({ where: { id: attachment.id } });

    // Invalidate search cache
    await invalidateUserSearchCache(user.id);

    return { message: 'Attachment deleted successfully.' };
  }

  @Post('attachment/:id/analyze')
  async analyzeAttachment(
    @Request() req: { user: { userId: string } },
    @Param('id') attachmentId: string,
  ) {
    const user = await this.findUserOrThrow(req.user.userId);

    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        diary_entry: { user_id: user.id },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found.');
    }

    // Get extracted text — either from DB or download & extract
    let text = attachment.extracted_text?.trim() ?? '';

    if (!text) {
      const fileBuffer = await this.storageService.downloadFile(
        'attachments-bucket',
        attachment.storage_path,
      );
      const base64Data = fileBuffer.toString('base64');
      text = await this.extractTextWithGemini(base64Data, attachment.file_type);

      if (text) {
        await this.prisma.attachment.update({
          where: { id: attachment.id },
          data: { extracted_text: text },
        });
      }
    }

    return this.analyzeTextWithGemini(text);
  }

  @Post('analyze-file')
  @UseInterceptors(FileInterceptor('file'))
  async analyzeFileDirectly(
    @Request() req: { user: { userId: string } },
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /^(image\/png|image\/jpe?g|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/plain)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    await this.findUserOrThrow(req.user.userId);

    let text = '';
    if (file.mimetype === 'text/plain') {
      text = file.buffer.toString('utf8').trim();
    } else {
      const base64Data = file.buffer.toString('base64');
      text = await this.extractTextWithGemini(base64Data, file.mimetype);
    }

    return this.analyzeTextWithGemini(text);
  }

  private async extractTextWithGemini(base64Data: string, mimeType: string): Promise<string> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new BadRequestException('AI key not configured.');

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: process.env.GEMINI_ANSWER_MODEL || 'gemini-2.5-flash' });

    const result = await model.generateContent([
      'Extract all readable text from this file. Return only the extracted text.',
      { inlineData: { data: base64Data, mimeType } },
    ]);
    return result.response.text().trim();
  }

  private async analyzeTextWithGemini(text: string) {
    if (!text) {
      return {
        summary: 'Could not extract any readable text from this file.',
        keyTakeaways: [],
        actionItems: [],
      };
    }

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new BadRequestException('AI key not configured.');

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: process.env.GEMINI_ANSWER_MODEL || 'gemini-2.5-flash' });

    const analyzePrompt = `You are a smart personal assistant for a Second Brain app.
Analyze the following document content and produce a structured analysis.

Respond in this EXACT JSON format (no markdown fences):
{
  "summary": "2-3 sentence overview of the document contents",
  "keyTakeaways": ["key point 1", "key point 2", "key point 3"],
  "actionItems": ["action 1", "action 2"]
}

If there are no action items, return an empty array.
Keep the summary concise and factual.

Document content:
${text.slice(0, 8000)}`;

    const analyzeResult = await model.generateContent(analyzePrompt);
    const rawResponse = analyzeResult.response.text().trim();

    try {
      const cleaned = rawResponse.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        summary: parsed.summary ?? '',
        keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      };
    } catch {
      return {
        summary: rawResponse.slice(0, 500),
        keyTakeaways: [],
        actionItems: [],
      };
    }
  }

  private extractPlainText(file: Express.Multer.File) {
    if (file.mimetype !== 'text/plain') {
      return null;
    }

    const text = file.buffer.toString('utf8').trim();
    return text.length > 0 ? text : null;
  }

  private async enqueueAttachmentIndexingJob(
    tx: any,
    input: {
    userId: string;
    attachmentId: string;
    sourceTitle: string;
    },
  ) {
    const job = await tx.indexingOutbox.upsert({
      where: {
        job_type_source_type_source_id: {
          job_type: 'index_memory',
          source_type: 'attachment',
          source_id: input.attachmentId,
        },
      },
      update: {
        user_id: input.userId,
        status: 'pending',
        retry_count: 0,
        error: null,
        payload: { sourceTitle: input.sourceTitle },
        run_after: new Date(),
        locked_at: null,
        processed_at: null,
      },
      create: {
        user_id: input.userId,
        job_type: 'index_memory',
        source_type: 'attachment',
        source_id: input.attachmentId,
        status: 'pending',
        payload: { sourceTitle: input.sourceTitle },
      },
    });

    await tx.searchHistory?.updateMany?.({
      where: {
        user_id: input.userId,
        expires_at: { gt: new Date() },
      },
      data: { expires_at: new Date() },
    });
    await invalidateUserSearchCache(input.userId);

    return job;
  }

  private getStoredFileName(storagePath: string) {
    return storagePath.split('/').pop() ?? storagePath;
  }

  private async findUserOrThrow(supabaseUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: supabaseUserId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  private async toClientAttachment(attachment: {
    id: string;
    diary_entry_id: string;
    storage_path: string;
    file_type: string;
    extracted_text: string | null;
    created_at: Date;
    diary_entry?: {
      id: string;
      entry_date: Date;
    };
  }) {
    const signedUrl =
      typeof this.storageService.createSignedUrl === 'function'
        ? await this.storageService
            .createSignedUrl('attachments-bucket', attachment.storage_path)
            .catch(() => undefined)
        : undefined;

    return {
      id: attachment.id,
      diaryEntryId: attachment.diary_entry_id,
      fileType: attachment.file_type,
      extractionStatus: attachment.extracted_text ? 'extracted' : 'pending',
      signedUrl,
      createdAt: attachment.created_at.toISOString(),
      entryDate: attachment.diary_entry?.entry_date.toISOString(),
    };
  }

  private toErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return 'Attachment processing failed.';
  }
}

type AttachmentIndexingResponse = {
  memoryIndexed: boolean;
  memoryChunkCount: number;
  processingError?: string;
};
