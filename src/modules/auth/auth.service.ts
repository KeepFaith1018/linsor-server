import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/db/prisma.service';
import { WechatLoginDto } from './dto/wechat-login.dto';
import axios from 'axios';

// 定义JWT payload类型
interface JwtPayload {
  userId: number;
  openid: string;
}

// 定义微信API响应类型
interface WechatApiResponse {
  openid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

// 定义微信用户信息类型
interface WechatUserInfo {
  openid: string;
  session_key: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // 微信小程序登录
  async wechatLogin(wechatLoginDto: WechatLoginDto) {
    const { code, nickname, avatar } = wechatLoginDto;

    try {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      throw new HttpException(
        '微信登录失败: ' + errorMessage,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 获取微信用户信息
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

  // 验证token
  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const user = await this.prisma.users.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new HttpException('用户不存在', HttpStatus.UNAUTHORIZED);
      }

      return user;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Token无效', HttpStatus.UNAUTHORIZED);
    }
  }

  // 获取用户信息
  async getUserInfo(userId: number) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    }

    return user;
  }
}
