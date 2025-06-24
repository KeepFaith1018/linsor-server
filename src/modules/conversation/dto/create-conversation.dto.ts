import { IsString, IsOptional, IsInt, IsIn } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsIn(['global', 'knowledge'])
  type: 'global' | 'knowledge';

  @IsOptional()
  @IsInt()
  knowledge_id?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  first_message: string; // 用户的第一条消息
}