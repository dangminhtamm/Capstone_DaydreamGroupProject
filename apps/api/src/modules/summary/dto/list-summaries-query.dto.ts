import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export const SUMMARY_TYPES = ['daily', 'weekly', 'monthly'] as const;
export type SummaryType = (typeof SUMMARY_TYPES)[number];

export class ListSummariesQueryDto {
  @IsOptional()
  @IsIn(SUMMARY_TYPES)
  type?: SummaryType;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
