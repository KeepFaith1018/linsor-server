import { IsOptional, IsInt } from 'class-validator';

export class GetConversationDetailDto {
  @IsOptional()
  @IsInt()
  knowledge_id?: string;
}
