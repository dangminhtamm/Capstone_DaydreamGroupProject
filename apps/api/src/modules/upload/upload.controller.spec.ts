import { NotFoundException } from '@nestjs/common';
import { indexMemoryFromAttachment } from '@second-brain/ai';
import { insertMemoryChunks, pruneMemoryChunksForSource } from '@second-brain/db';
import { UploadController } from './upload.controller';

const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

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
    $transaction: jest.fn((fn: any) => fn(prisma)),
  };

  let controller: UploadController;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    controller = new UploadController(storageService as any, prisma as any);
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Extracted PDF text about the Alpha research plan.',
      },
    });
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

  it('stores extracted text and indexes text attachments into memory chunks', async () => {
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
    expect(indexMemoryFromAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        attachmentId: 'attachment-1',
        diaryEntryId: 'diary-1',
        extractedText: 'hello world from upload',
        sourceTitle: 'note.txt',
        fileType: 'text/plain',
      }),
    );
    expect(insertMemoryChunks).toHaveBeenCalledWith(
      prisma,
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'user-1',
          sourceType: 'attachment',
          sourceId: 'attachment-1',
          text: 'hello world from upload',
        }),
      ]),
    );
    expect(pruneMemoryChunksForSource).toHaveBeenCalledWith(
      prisma,
      {
        userId: 'user-1',
        sourceType: 'attachment',
        sourceId: 'attachment-1',
        keepChunkCount: 1,
      },
    );
    expect(result).toMatchObject({
      extractionStatus: 'extracted',
      memoryIndexed: true,
      memoryChunkCount: 1,
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
    expect(result).toMatchObject({
      extractionStatus: 'pending',
      memoryIndexed: false,
      memoryChunkCount: 0,
    });
  });

  it('extracts pending attachments and indexes them into memory chunks on demand', async () => {
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
    storageService.downloadFile.mockResolvedValue(Buffer.from('%PDF-1.4'));
    prisma.attachment.update.mockResolvedValue({
      id: 'attachment-2',
      extracted_text: 'Extracted PDF text about the Alpha research plan.',
    });

    const result = await controller.processAttachmentNow(
      { user: { userId: 'supabase-user-1' } },
      'attachment-2',
    );

    expect(storageService.downloadFile).toHaveBeenCalledWith(
      'attachments-bucket',
      'attachments/research.pdf',
    );
    expect(mockGenerateContent).toHaveBeenCalled();
    expect(prisma.attachment.update).toHaveBeenCalledWith({
      where: { id: 'attachment-2' },
      data: { extracted_text: 'Extracted PDF text about the Alpha research plan.' },
    });
    expect(indexMemoryFromAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        attachmentId: 'attachment-2',
        diaryEntryId: 'diary-1',
        extractedText: 'Extracted PDF text about the Alpha research plan.',
        fileType: 'application/pdf',
      }),
    );
    expect(result).toMatchObject({
      extractionStatus: 'extracted',
      memoryIndexed: true,
      memoryChunkCount: 1,
    });
  });

  it('keeps a pending attachment when extraction fails instead of throwing a 500', async () => {
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
    storageService.downloadFile.mockResolvedValue(Buffer.from('image-data'));
    mockGenerateContent.mockRejectedValue(new Error('Gemini extraction failed'));

    const result = await controller.processAttachmentNow(
      { user: { userId: 'supabase-user-1' } },
      'attachment-3',
    );

    expect(prisma.attachment.update).not.toHaveBeenCalled();
    expect(indexMemoryFromAttachment).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      extractionStatus: 'pending',
      memoryIndexed: false,
      memoryChunkCount: 0,
      processingError: 'Gemini extraction failed',
      attachment: {
        id: 'attachment-3',
        extractedText: null,
      },
    });
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
