import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
