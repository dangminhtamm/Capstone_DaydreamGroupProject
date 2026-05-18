import { NotFoundException } from '@nestjs/common';
import { createDefaultEmbeddingProvider } from '@second-brain/ai';
import { insertMemoryChunks } from '@second-brain/db';
import { UploadController } from './upload.controller';

jest.mock('@second-brain/ai', () => ({
  createDefaultEmbeddingProvider: jest.fn(),
}));

jest.mock('@second-brain/db', () => ({
  insertMemoryChunks: jest.fn(),
}));

describe('UploadController', () => {
  const storageService = {
    uploadFile: jest.fn(),
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
    },
  };

  let controller: UploadController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UploadController(storageService as any, prisma as any);
    (createDefaultEmbeddingProvider as jest.Mock).mockReturnValue({
      embedDocument: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
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
    expect(result).toMatchObject({
      extractionStatus: 'extracted',
      memoryIndexed: true,
    });
  });
});

function textFile(originalname: string, content: string): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype: 'text/plain',
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content),
    destination: '',
    filename: originalname,
    path: '',
    stream: undefined as any,
  };
}
