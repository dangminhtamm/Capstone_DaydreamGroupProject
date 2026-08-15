import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportDriveFilesDto } from './dto/import-drive-files.dto';
import { DriveService } from './drive.service';

@Controller('drive')
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@Req() req) {
    return this.driveService.getConnectionStatus(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('candidates')
  async getImportCandidates(
    @Req() req,
    @Query('limit') limit?: string,
    @Query('q') query?: string,
  ) {
    return this.driveService.listImportCandidates(req.user.userId, {
      limit: this.parseFileLimit(limit),
      query,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('import')
  async importSelectedFiles(@Req() req, @Body() body: ImportDriveFilesDto) {
    return this.driveService.importSelectedFiles(req.user.userId, body.fileIds);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  async syncDrive(@Req() req, @Query('limit') limit?: string) {
    return this.driveService.syncGoogleDriveFiles(req.user.userId, {
      limit: this.parseFileLimit(limit),
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('files')
  async getFiles(@Req() req) {
    const files = await this.driveService.getFilesFromDb(req.user.userId);

    return {
      message: 'Drive files fetched from database successfully',
      count: files.length,
      files: files.map((file) => ({
        ...file,
        size: file.size === null ? null : file.size.toString(),
      })),
    };
  }

  private parseFileLimit(value?: string) {
    if (!value) return undefined;

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return undefined;

    return Math.min(Math.max(parsed, 1), 200);
  }
}
