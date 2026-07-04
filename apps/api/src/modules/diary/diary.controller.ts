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
} from '@nestjs/common';
import { DiaryService } from './diary.service';
import { CreateDiaryDto } from './dto/create-diary.dto';
import { CopilotDto } from './dto/copilot.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('diary')
@UseGuards(JwtAuthGuard) // Protects all diary routes
export class DiaryController {
  constructor(private readonly diaryService: DiaryService) {}

  // IMPORTANT: Copilot must be declared BEFORE the generic @Post()
  // because NestJS evaluates routes top-down and @Post() would
  // catch /diary/copilot otherwise.
  @Post('copilot')
  copilot(@Request() req, @Body() copilotDto: CopilotDto) {
    return this.diaryService.copilot(req.user.userId, copilotDto.text, copilotDto.action);
  }

  @Post()
  create(@Request() req, @Body() createDiaryDto: CreateDiaryDto) {
    return this.diaryService.create(req.user.userId, createDiaryDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.diaryService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.diaryService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateDiaryDto>,
  ) {
    return this.diaryService.update(req.user.userId, id, updateDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.diaryService.remove(req.user.userId, id);
  }
}
