import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class SearchQueryDto {
  @IsString()
  @MinLength(1)
  question: string;

  @IsOptional()
  @IsString()
  chunkType?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  maxDistance?: number;

  @IsOptional()
  @IsString()
  @IsIn(['en', 'vi'])
  responseLanguage?: 'en' | 'vi';

  @IsOptional()
  @IsString()
  @IsIn(['auto', 'fast', 'deep'])
  answerStrategy?: 'auto' | 'fast' | 'deep';
}
