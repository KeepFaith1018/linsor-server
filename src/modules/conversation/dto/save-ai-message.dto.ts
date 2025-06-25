import { IsString, IsInt, IsBoolean } from 'class-validator';

export class SaveAiMessageDto {
  @IsInt()
  conversation_id: number; // 会话ID

  @IsString()
  content: string; // AI回复内容

  @IsBoolean()
  isSuccess: boolean; // 是否成功完成（true: 正常完成, false: 用户终止）
}
