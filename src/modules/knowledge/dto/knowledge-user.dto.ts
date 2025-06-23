import { IsNumber } from 'class-validator';

export class KnowledgeUserDto {
  @IsNumber()
  knowledge_id: number;

  @IsNumber()
  user_id: number;
}