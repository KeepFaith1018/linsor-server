import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WechatLoginDto } from './dto/wechat-login.dto';
import axios from 'axios';
import { JwtPayload, WechatApiResponse, WechatUserInfo } from './types/index';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // 微信小程序登录
  async wechatLogin(wechatLoginDto: WechatLoginDto) {
    const { code, nickname, avatar } = wechatLoginDto;

    // 1. 通过code获取openid和session_key
    const { openid, session_key } = await this.getWechatUserInfo(code);

    // 2. 查找或创建用户
    let user = await this.prisma.users.findFirst({
      where: { openid },
    });

    if (!user) {
      // 创建新用户
      user = await this.prisma.users.create({
        data: {
          openid,
          nickname: nickname || '微信用户',
          avatar: avatar || '',
          session_key,
        },
      });
    } else {
      // 更新用户信息
      user = await this.prisma.users.update({
        where: { id: user.id },
        data: {
          nickname: nickname || user.nickname,
          avatar: avatar || user.avatar,
          session_key,
          updated_at: new Date(),
        },
      });
    }

    // 3. 生成JWT token
    const payload: JwtPayload = { userId: user.id, openid };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
      },
    };
  }

  /**
   * 微信服务端获取用户信息及会话码
   * @param code
   * @returns
   */
  private async getWechatUserInfo(code: string): Promise<WechatUserInfo> {
    const appId = process.env.WECHAT_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error('微信小程序配置缺失');
    }

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;

    try {
      const response = await axios.get<WechatApiResponse>(url);
      const { openid, session_key, errcode, errmsg } = response.data;

      if (errcode) {
        throw new Error(`微信API错误: ${errmsg}`);
      }

      if (!openid || !session_key) {
        throw new Error('微信API返回数据不完整');
      }

      return { openid, session_key };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`网络请求失败: ${error.message}`);
      }
      throw error;
    }
  }
}
