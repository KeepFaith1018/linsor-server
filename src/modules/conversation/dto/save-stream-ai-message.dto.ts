import { IsNumber, IsString, IsBoolean } from 'class-validator';

export class SaveStreamAiMessageDto {
  @IsNumber()
  conversation_id: number;

  @IsString()
  content: string;

  @IsBoolean()
  isSuccess: boolean; // true=用户终止，false=正常完成
}
