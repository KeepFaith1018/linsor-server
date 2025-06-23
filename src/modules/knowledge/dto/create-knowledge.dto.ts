import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateKnowledgeDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  is_shared?: boolean;
}