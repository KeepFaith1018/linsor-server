import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class QueryKnowledgeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  is_shared?: boolean;

  @IsNumber()
  @IsOptional()
  owner_id?: number;

  @IsBoolean()
  @IsOptional()
  is_deleted?: boolean = false;
}