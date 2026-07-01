// apps/api/src/upload/upload.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
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
import { GoogleGenerativeAI } from '@google/generative-ai';
import { indexMemoryFromAttachment } from '@second-brain/ai';
import { insertMemoryChunks, pruneMemoryChunksForSource } from '@second-brain/db';
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
      attachments: attachments.map((attachment) =>
        this.toClientAttachment(attachment),
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
            fileType: /^(image\/png|image\/jpeg|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/plain)$/,
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
    );

    const extractedText = this.extractPlainText(file);
    const attachment = await this.prisma.attachment.create({
      data: {
        diary_entry_id: diaryEntry.id,
        storage_path: uploadedFile.path,
        file_type: file.mimetype,
        ...(extractedText && { extracted_text: extractedText }),
      },
    });

    let indexingResult: AttachmentIndexingResponse = {
      memoryIndexed: false,
      memoryChunkCount: 0,
    };
    if (extractedText) {
      try {
        indexingResult = await this.indexExtractedAttachment({
          userId: user.id,
          diaryEntryId: diaryEntry.id,
          attachmentId: attachment.id,
          extractedText,
          occurredAt: diaryEntry.entry_date,
          sourceTitle: file.originalname,
          fileType: file.mimetype,
        });
      } catch (error) {
        indexingResult = {
          memoryIndexed: false,
          memoryChunkCount: 0,
          processingError: this.toErrorMessage(error),
        };
      }
    }

    return {
      message: 'Upload successful',
      url: uploadedFile.url,
      extractionStatus: extractedText ? 'extracted' : 'pending',
      ...indexingResult,
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

    let extractedText = attachment.extracted_text?.trim() ?? '';

    if (!extractedText) {
      try {
        const fileBuffer = await this.storageService.downloadFile(
          'attachments-bucket',
          attachment.storage_path,
        );
        extractedText = await this.extractTextFromBlob(
          fileBuffer.toString('base64'),
          attachment.file_type,
        );

        await this.prisma.attachment.update({
          where: { id: attachment.id },
          data: { extracted_text: extractedText },
        });
      } catch (error) {
        return {
          message: 'Attachment saved; extraction is still pending',
          extractionStatus: 'pending',
          memoryIndexed: false,
          memoryChunkCount: 0,
          processingError: this.toErrorMessage(error),
          attachment: {
            id: attachment.id,
            diaryEntryId: attachment.diary_entry.id,
            storagePath: attachment.storage_path,
            fileType: attachment.file_type,
            extractedText: null,
            createdAt: attachment.created_at.toISOString(),
          },
        };
      }
    }

    let indexingResult: AttachmentIndexingResponse;
    try {
      indexingResult = await this.indexExtractedAttachment({
        userId: user.id,
        diaryEntryId: attachment.diary_entry.id,
        attachmentId: attachment.id,
        extractedText,
        occurredAt: attachment.diary_entry.entry_date,
        sourceTitle: this.getStoredFileName(attachment.storage_path),
        fileType: attachment.file_type,
      });
    } catch (error) {
      indexingResult = {
        memoryIndexed: false,
        memoryChunkCount: 0,
        processingError: this.toErrorMessage(error),
      };
    }

    return {
      message: 'Attachment processed',
      extractionStatus: extractedText ? 'extracted' : 'empty',
      ...indexingResult,
      attachment: {
        id: attachment.id,
        diaryEntryId: attachment.diary_entry.id,
        storagePath: attachment.storage_path,
        fileType: attachment.file_type,
        extractedText,
        createdAt: attachment.created_at.toISOString(),
      },
    };
  }

  private extractPlainText(file: Express.Multer.File) {
    if (file.mimetype !== 'text/plain') {
      return null;
    }

    const text = file.buffer.toString('utf8').trim();
    return text.length > 0 ? text : null;
  }

  private async extractTextFromBlob(base64Data: string, mimeType: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY is not configured.');
    }

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({
      model: process.env.GEMINI_VISION_MODEL ?? 'gemini-1.5-flash',
    });

    const prompt = `
You are an extraction engine for a personal Second Brain app.
Extract all readable text, transcripts, headings, labels, and meaningful textual content from this attachment.
For images with little or no visible text, provide a concise factual description of what is shown.
Do not invent names, dates, or claims that are not visible in the file.
Return only the extracted text or factual description.
`.trim();

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      },
    ]);
    const extractedText = result.response.text().trim();

    if (!extractedText) {
      throw new InternalServerErrorException('Attachment extraction returned empty text.');
    }

    return extractedText;
  }

  private async indexExtractedAttachment(input: {
    userId: string;
    diaryEntryId: string;
    attachmentId: string;
    extractedText: string;
    occurredAt: Date;
    sourceTitle: string;
    fileType: string;
  }) {
    const indexingResult = await indexMemoryFromAttachment({
      userId: input.userId,
      attachmentId: input.attachmentId,
      diaryEntryId: input.diaryEntryId,
      extractedText: input.extractedText,
      occurredAt: input.occurredAt,
      sourceTitle: input.sourceTitle,
      fileType: input.fileType,
      insertChunks: (chunks) =>
        this.prisma.$transaction(async (tx) => {
          await insertMemoryChunks(tx as any, chunks);
          await pruneMemoryChunksForSource(tx as any, {
            userId: input.userId,
            sourceType: 'attachment',
            sourceId: input.attachmentId,
            keepChunkCount: chunks.length,
          });
        }),
    });

    return {
      memoryIndexed: indexingResult.chunkCount > 0,
      memoryChunkCount: indexingResult.chunkCount,
    };
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

  private toClientAttachment(attachment: {
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
    return {
      id: attachment.id,
      diaryEntryId: attachment.diary_entry_id,
      storagePath: attachment.storage_path,
      fileType: attachment.file_type,
      extractionStatus: attachment.extracted_text ? 'extracted' : 'pending',
      extractedText: attachment.extracted_text,
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
