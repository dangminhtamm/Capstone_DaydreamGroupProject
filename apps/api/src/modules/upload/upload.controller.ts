// apps/api/src/upload/upload.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
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
import {
  AUDIO_ATTACHMENT_MAX_BYTES,
  getAttachmentValidationError,
  SUPPORTED_ATTACHMENT_MIME_PATTERN,
} from './attachment-upload-policy';

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
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: AUDIO_ATTACHMENT_MAX_BYTES },
  }))
  async uploadAttachment(
    @Request() req: { user: { userId: string } },
    @Body('diaryEntryId') diaryEntryId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: AUDIO_ATTACHMENT_MAX_BYTES }),
          new FileTypeValidator({
            fileType: SUPPORTED_ATTACHMENT_MIME_PATTERN,
            fallbackToMimetype: true,
            errorMessage: 'Unsupported attachment content. Upload a supported document, image, or audio file.',
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!diaryEntryId) {
      throw new BadRequestException('diaryEntryId is required.');
    }

    const validationError = getAttachmentValidationError(file);
    if (validationError) {
      throw new BadRequestException(validationError);
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
        locked_by: null,
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
