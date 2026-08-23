import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class CopilotDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['continue', 'fix_grammar', 'expand', 'summarize', 'reflect'])
  action: string;
}
