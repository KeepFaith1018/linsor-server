import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('缺少token');
    }

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token格式错误');
    }

    try {
      const payload = this.jwtService.verify<{
        userId: number;
        openId: string;
      }>(token);
      // 把解析后的用户信息挂到请求对象上
      request['userId'] = payload.userId;
      return true;
    } catch (e) {
      throw new UnauthorizedException('Token无效或过期');
    }
  }
}
