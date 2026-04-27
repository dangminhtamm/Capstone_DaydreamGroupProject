// apps/api/src/upload/upload.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../src/storage/storage.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  @Post('attachment')
  @UseInterceptors(FileInterceptor('file')) // 'file' matches the field name in your form-data
  async uploadAttachment(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB limit
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|pdf|doc)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const url = await this.storageService.uploadFile(
      file,
      'attachments-bucket',
    );

    return {
      message: 'Upload successful',
      url,
    };
  }
}
