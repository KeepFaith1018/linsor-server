import { IsOptional, IsString, IsInt } from 'class-validator';

export class QueryConversationDto {
  @IsOptional()
  @IsString()
  type?: 'global' | 'knowledge';

  @IsOptional()
  @IsInt()
  knowledge_id?: number;

  @IsOptional()
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @IsInt()
  limit?: number = 20;
}