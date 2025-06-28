import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WechatLoginDto {
  @ApiProperty({ description: '微信授权码', example: 'wx_auth_code_123' })
  @IsString()
  code: string; // 微信授权码

  @ApiProperty({ description: '用户昵称', example: '张三', required: false })
  @IsOptional()
  @IsString()
  nickname?: string; // 用户昵称

  @ApiProperty({
    description: '用户头像URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  avatar?: string; // 用户头像
}
