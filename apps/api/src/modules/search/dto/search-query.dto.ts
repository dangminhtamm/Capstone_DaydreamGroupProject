import { IsString, IsOptional, MinLength } from 'class-validator';

export class SearchQueryDto {
  @IsString()
  @MinLength(1)
  q: string; // The search term

  @IsOptional()
  @IsString()
  limit?: string; // Optional result limit
}
