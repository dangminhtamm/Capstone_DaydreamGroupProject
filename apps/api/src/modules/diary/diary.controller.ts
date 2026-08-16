import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { DiaryService } from './diary.service';
import { CreateDiaryDto } from './dto/create-diary.dto';
import { CopilotDto } from './dto/copilot.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

export const MAX_DIARY_ENTRIES_PER_REQUEST = 500;

type AuthenticatedRequest = { user: { userId: string } };

export function parseDiaryLimit(value?: string) {
  if (!value) return undefined;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;

  return Math.min(Math.max(parsed, 1), MAX_DIARY_ENTRIES_PER_REQUEST);
}

@Controller('diary')
@UseGuards(JwtAuthGuard) // Protects all diary routes
export class DiaryController {
  constructor(private readonly diaryService: DiaryService) {}

  // IMPORTANT: Copilot must be declared BEFORE the generic @Post()
  // because NestJS evaluates routes top-down and @Post() would
  // catch /diary/copilot otherwise.
  @Post('copilot')
  copilot(
    @Request() req: AuthenticatedRequest,
    @Body() copilotDto: CopilotDto,
  ) {
    return this.diaryService.copilot(
      req.user.userId,
      copilotDto.text,
      copilotDto.action,
    );
  }

  @Post()
  create(
    @Request() req: AuthenticatedRequest,
    @Body() createDiaryDto: CreateDiaryDto,
  ) {
    return this.diaryService.create(req.user.userId, createDiaryDto);
  }

  @Get()
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    return this.diaryService.findAll(req.user.userId, {
      limit: parseDiaryLimit(limit),
    });
  }

  @Get(':id')
  findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.diaryService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateDiaryDto>,
  ) {
    return this.diaryService.update(req.user.userId, id, updateDto);
  }

  @Delete(':id')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.diaryService.remove(req.user.userId, id);
  }
}
