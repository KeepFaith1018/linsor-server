import { IsOptional, IsString } from 'class-validator';

export class WechatLoginDto {
  @IsString()
  code: string; // 微信授权码

  @IsOptional()
  @IsString()
  nickname?: string; // 用户昵称

  @IsOptional()
  @IsString()
  avatar?: string; // 用户头像
}
