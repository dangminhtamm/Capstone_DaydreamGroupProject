import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const DIARY_MOODS = ['great', 'good', 'neutral', 'bad'] as const;

export class CreateDiaryDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  attachments?: string[]; // Array of URLs from your /upload API

  @IsDateString()
  @IsOptional()
  entryDate?: string;

  @IsIn(DIARY_MOODS)
  @IsOptional()
  mood?: (typeof DIARY_MOODS)[number];

  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  @IsOptional()
  tags?: string[];
}
