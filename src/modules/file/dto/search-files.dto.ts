import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class SearchFilesDto {
  @IsNumber()
  @Type(() => Number)
  knowledge_id: number;
  @IsString()
  filename: string;

  page?: number = 1;
  limit?: number = 20;
}
