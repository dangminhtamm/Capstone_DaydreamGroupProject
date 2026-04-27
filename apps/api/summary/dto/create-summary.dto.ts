import { IsString, MinLength } from 'class-validator';

export class CreateSummaryDto {
  @IsString()
  @MinLength(10, { message: 'Content is too short to summarize' })
  content: string;
}
