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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('diary')
@UseGuards(JwtAuthGuard) // Protects all diary routes
export class DiaryController {
  constructor(private readonly diaryService: DiaryService) {}

  @Post()
  create(@Request() req, @Body() createDiaryDto: CreateDiaryDto) {
    return this.diaryService.create(req.user.id, createDiaryDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.diaryService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.diaryService.findOne(req.user.id, id);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateDiaryDto>,
  ) {
    return this.diaryService.update(req.user.id, id, updateDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.diaryService.remove(req.user.id, id);
  }
}
