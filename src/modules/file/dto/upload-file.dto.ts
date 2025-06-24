import { Type } from 'class-transformer';
import { IsNotEmpty } from 'class-validator';

export class UploadFileDto {
  @IsNotEmpty()
  @Type(() => Number)
  knowledge_id: number;
}
