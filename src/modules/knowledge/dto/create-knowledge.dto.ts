import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateKnowledgeDto {
  @ApiProperty({ description: '知识库名', example: '知识库名' })
  @IsString()
  name: string;
  @ApiProperty({ description: '描述', example: '描述', required: false })
  @IsString()
  @IsOptional()
  description?: string;
  @ApiProperty({ description: '是否共享', example: 'false', required: false })
  @IsBoolean()
  @IsOptional()
  is_shared?: boolean;
  @ApiProperty({
    description: '知识库头像',
    example: 'http://avatar.com/123.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  avatar?: string;
}
