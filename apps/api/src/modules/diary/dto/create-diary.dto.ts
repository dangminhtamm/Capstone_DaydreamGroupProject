import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

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
}
