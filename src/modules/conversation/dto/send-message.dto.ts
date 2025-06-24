import { IsString, IsInt } from 'class-validator';

export class SendMessageDto {
  @IsInt()
  conversation_id: number;

  @IsString()
  content: string;
}