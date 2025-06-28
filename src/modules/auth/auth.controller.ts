import { Controller, Post, Body, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { Logger } from 'winston';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
@ApiTags('认证')
@Controller('auth')
export class AuthController {
  @Inject(WINSTON_MODULE_NEST_PROVIDER)
  private readonly logger: Logger;
  constructor(private readonly authService: AuthService) {}

  // 微信小程序登录
  @Post('login')
  @ApiOperation({
    summary: '微信小程序登录',
    description: '通过微信授权码进行用户登录',
  })
  @ApiBody({ type: WechatLoginDto })
  @ApiResponse({ status: 200, description: 'success' })
  async wxLogin(@Body() wechatLoginDto: WechatLoginDto) {
    return await this.authService.wechatLogin(wechatLoginDto);
  }
}
