import { IsBoolean, IsIn, IsISO8601, IsOptional } from 'class-validator';
import { SUMMARY_TYPES, type SummaryType } from './list-summaries-query.dto';

export class CreateSummaryDto {
  @IsIn(SUMMARY_TYPES)
  type!: SummaryType;

  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
