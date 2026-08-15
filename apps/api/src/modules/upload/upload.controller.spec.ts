import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AUDIO_ATTACHMENT_MAX_BYTES } from './attachment-upload-policy';
import { indexMemoryFromAttachment } from '@second-brain/ai';
import { insertMemoryChunks, pruneMemoryChunksForSource } from '@second-brain/db';
import { UploadController } from './upload.controller';

jest.mock('@second-brain/ai', () => ({
  indexMemoryFromAttachment: jest.fn(),
}));

jest.mock('@second-brain/db', () => ({
  insertMemoryChunks: jest.fn(),
  pruneMemoryChunksForSource: jest.fn(),
}));

describe('UploadController', () => {
  const storageService = {
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
    deleteFile: jest.fn(),
  };
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    diaryEntry: {
      findFirst: jest.fn(),
    },
    attachment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    indexingOutbox: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(prisma)),
  };

  let controller: UploadController;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TUTURUUU_AI_API_KEY = 'test-tuturuuu-key';
    controller = new UploadController(storageService as any, prisma as any);
    (indexMemoryFromAttachment as jest.Mock).mockImplementation(async (input) => {
      await input.insertChunks([
        {
          userId: input.userId,
          sourceType: 'attachment',
          sourceId: input.attachmentId,
          chunkIndex: 0,
          chunkType: 'general_note',
          text: input.extractedText,
          evidence: input.extractedText.slice(0, 500),
          metadata: {
            sourceType: 'attachment',
            sourceId: input.attachmentId,
            diaryEntryId: input.diaryEntryId,
            fileType: input.fileType,
          },
          occurredAt: new Date(input.occurredAt),
          embedding: [0.1, 0.2, 0.3],
        },
      ]);
      return { sourceType: 'attachment', sourceId: input.attachmentId, chunkCount: 1, chunks: [] };
    });
  });

  it('requires the target diary entry to belong to the authenticated user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.diaryEntry.findFirst.mockResolvedValue(null);

    await expect(
      controller.uploadAttachment(
        { user: { userId: 'supabase-user-1' } },
        'diary-1',
        textFile('note.txt', 'hello world from upload'),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.diaryEntry.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'diary-1',
        user_id: 'user-1',
      },
      select: { id: true, entry_date: true },
    });
    expect(storageService.uploadFile).not.toHaveBeenCalled();
  });

  it('stores extracted text and queues text attachment indexing', async () => {
    const entryDate = new Date('2026-05-18T09:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.diaryEntry.findFirst.mockResolvedValue({
      id: 'diary-1',
      entry_date: entryDate,
    });
    storageService.uploadFile.mockResolvedValue({
      path: 'attachments/note.txt',
      url: 'https://storage.local/note.txt',
    });
    prisma.attachment.create.mockResolvedValue({
      id: 'attachment-1',
      diary_entry_id: 'diary-1',
      storage_path: 'attachments/note.txt',
      file_type: 'text/plain',
      extracted_text: 'hello world from upload',
      created_at: entryDate,
    });

    const result = await controller.uploadAttachment(
      { user: { userId: 'supabase-user-1' } },
      'diary-1',
      textFile('note.txt', 'hello world from upload'),
    );

    expect(prisma.attachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        diary_entry_id: 'diary-1',
        extracted_text: 'hello world from upload',
      }),
    });
    expect(prisma.indexingOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          job_type_source_type_source_id: {
            job_type: 'index_memory',
            source_type: 'attachment',
            source_id: 'attachment-1',
          },
        },
      }),
    );
    expect(indexMemoryFromAttachment).not.toHaveBeenCalled();
    expect(insertMemoryChunks).not.toHaveBeenCalled();
    expect(pruneMemoryChunksForSource).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      extractionStatus: 'extracted',
      memoryIndexed: false,
      memoryIndexingStatus: 'queued',
      memoryChunkCount: 0,
    });
  });

  it('stores non-text attachments as pending without indexing during upload', async () => {
    const entryDate = new Date('2026-05-18T09:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.diaryEntry.findFirst.mockResolvedValue({
      id: 'diary-1',
      entry_date: entryDate,
    });
    storageService.uploadFile.mockResolvedValue({
      path: 'attachments/research.pdf',
      url: 'https://storage.local/research.pdf',
    });
    prisma.attachment.create.mockResolvedValue({
      id: 'attachment-2',
      diary_entry_id: 'diary-1',
      storage_path: 'attachments/research.pdf',
      file_type: 'application/pdf',
      extracted_text: null,
      created_at: entryDate,
    });

    const result = await controller.uploadAttachment(
      { user: { userId: 'supabase-user-1' } },
      'diary-1',
      fileFixture('research.pdf', 'application/pdf', '%PDF-1.4'),
    );

    expect(prisma.attachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        diary_entry_id: 'diary-1',
        file_type: 'application/pdf',
      }),
    });
    expect(indexMemoryFromAttachment).not.toHaveBeenCalled();
    expect(prisma.indexingOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          job_type_source_type_source_id: {
            job_type: 'index_memory',
            source_type: 'attachment',
            source_id: 'attachment-2',
          },
        },
      }),
    );
    expect(result).toMatchObject({
      extractionStatus: 'pending',
      memoryIndexed: false,
      memoryIndexingStatus: 'queued',
      memoryChunkCount: 0,
    });
  });

  it('stores audio attachments as pending transcription jobs', async () => {
    const entryDate = new Date('2026-05-18T09:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.diaryEntry.findFirst.mockResolvedValue({
      id: 'diary-1',
      entry_date: entryDate,
    });
    storageService.uploadFile.mockResolvedValue({
      path: 'attachments/meeting.m4a',
    });
    prisma.attachment.create.mockResolvedValue({
      id: 'attachment-audio-1',
      diary_entry_id: 'diary-1',
      storage_path: 'attachments/meeting.m4a',
      file_type: 'audio/mp4',
      extracted_text: null,
      created_at: entryDate,
    });

    const result = await controller.uploadAttachment(
      { user: { userId: 'supabase-user-1' } },
      'diary-1',
      fileFixture('meeting.m4a', 'audio/mp4', 'audio-bytes'),
    );

    expect(prisma.attachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        diary_entry_id: 'diary-1',
        file_type: 'audio/mp4',
      }),
    });
    expect(prisma.indexingOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          job_type_source_type_source_id: {
            job_type: 'index_memory',
            source_type: 'attachment',
            source_id: 'attachment-audio-1',
          },
        },
      }),
    );
    expect(result).toMatchObject({
      extractionStatus: 'pending',
      memoryIndexingStatus: 'queued',
      attachment: { fileType: 'audio/mp4' },
    });
  });

  it('rejects audio files larger than the audio upload limit', async () => {
    const file = fileFixture('long-recording.mp3', 'audio/mpeg', 'audio');
    file.size = AUDIO_ATTACHMENT_MAX_BYTES + 1;

    await expect(controller.uploadAttachment(
      { user: { userId: 'supabase-user-1' } },
      'diary-1',
      file,
    )).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.uploadFile).not.toHaveBeenCalled();
  });

  it('removes the uploaded storage object if attachment DB creation fails', async () => {
    const entryDate = new Date('2026-05-18T09:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.diaryEntry.findFirst.mockResolvedValue({
      id: 'diary-1',
      entry_date: entryDate,
    });
    storageService.uploadFile.mockResolvedValue({
      path: 'attachments/orphan.pdf',
      url: 'https://storage.local/orphan.pdf',
    });
    const dbError = new Error('database insert failed');
    prisma.$transaction.mockRejectedValueOnce(dbError);
    storageService.deleteFile.mockResolvedValue(undefined);

    await expect(
      controller.uploadAttachment(
        { user: { userId: 'supabase-user-1' } },
        'diary-1',
        fileFixture('orphan.pdf', 'application/pdf', '%PDF-1.4'),
      ),
    ).rejects.toThrow('database insert failed');

    expect(storageService.deleteFile).toHaveBeenCalledWith(
      'attachments-bucket',
      'attachments/orphan.pdf',
    );
  });

  it('queues pending attachments for background processing on demand', async () => {
    const entryDate = new Date('2026-05-18T09:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.attachment.findFirst.mockResolvedValue({
      id: 'attachment-2',
      diary_entry_id: 'diary-1',
      storage_path: 'attachments/research.pdf',
      file_type: 'application/pdf',
      extracted_text: null,
      created_at: entryDate,
      diary_entry: {
        id: 'diary-1',
        entry_date: entryDate,
      },
    });
    const result = await controller.processAttachmentNow(
      { user: { userId: 'supabase-user-1' } },
      'attachment-2',
    );

    expect(storageService.downloadFile).not.toHaveBeenCalled();
    expect(prisma.attachment.update).not.toHaveBeenCalled();
    expect(indexMemoryFromAttachment).not.toHaveBeenCalled();
    expect(prisma.indexingOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          job_type_source_type_source_id: {
            job_type: 'index_memory',
            source_type: 'attachment',
            source_id: 'attachment-2',
          },
        },
      }),
    );
    expect(result).toMatchObject({
      extractionStatus: 'pending',
      memoryIndexed: false,
      memoryIndexingStatus: 'queued',
      memoryChunkCount: 0,
    });
  });

  it('requeues a pending attachment without running extraction in the API request', async () => {
    const entryDate = new Date('2026-05-18T09:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.attachment.findFirst.mockResolvedValue({
      id: 'attachment-3',
      diary_entry_id: 'diary-1',
      storage_path: 'attachments/photo.png',
      file_type: 'image/png',
      extracted_text: null,
      created_at: entryDate,
      diary_entry: {
        id: 'diary-1',
        entry_date: entryDate,
      },
    });
    const result = await controller.processAttachmentNow(
      { user: { userId: 'supabase-user-1' } },
      'attachment-3',
    );

    expect(storageService.downloadFile).not.toHaveBeenCalled();
    expect(prisma.attachment.update).not.toHaveBeenCalled();
    expect(indexMemoryFromAttachment).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      extractionStatus: 'pending',
      memoryIndexed: false,
      memoryIndexingStatus: 'queued',
      memoryChunkCount: 0,
      attachment: {
        id: 'attachment-3',
      },
    });
    expect(result.attachment).not.toHaveProperty('storagePath');
    expect(result.attachment).not.toHaveProperty('extractedText');
  });
});

function textFile(originalname: string, content: string): Express.Multer.File {
  return fileFixture(originalname, 'text/plain', content);
}

function fileFixture(originalname: string, mimetype: string, content: string): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content),
    destination: '',
    filename: originalname,
    path: '',
    stream: undefined as any,
  };
}
