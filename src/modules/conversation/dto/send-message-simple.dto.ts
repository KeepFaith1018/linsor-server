import { IsString, IsOptional, IsInt } from 'class-validator';

export class SendMessageSimpleDto {
  @IsString()
  content: string; // 消息内容

  @IsOptional()
  @IsInt()
  knowledge_id?: number; // 知识库ID

  @IsInt()
  conversation_id: number; // 会话ID
}