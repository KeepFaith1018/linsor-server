import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { WechatLoginDto } from './dto/wechat-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 微信小程序登录
  @Post('login')
  async wxLogin(@Body() wechatLoginDto: WechatLoginDto) {
    return await this.authService.wechatLogin(wechatLoginDto);
  }

  // 验证token
  @Post('verify')
  async verifyToken(@Headers('authorization') authorization: string) {
    if (!authorization) {
      throw new HttpException('缺少Authorization头', HttpStatus.UNAUTHORIZED);
    }

    const token = authorization.replace('Bearer ', '');
    return await this.authService.validateToken(token);
  }

  // 获取用户信息
  @Get('profile')
  async getProfile(@Headers('authorization') authorization: string) {
    if (!authorization) {
      throw new HttpException('缺少Authorization头', HttpStatus.UNAUTHORIZED);
    }

    const token = authorization.replace('Bearer ', '');
    const user = await this.authService.validateToken(token);
    return await this.authService.getUserInfo(user.id);
  }
}
