import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './common/db/prisma.service';
import { Result } from './common/utils/result';

@Controller()
export class AppController {
  @Inject()
  private prisma: PrismaService;
  constructor(private readonly appService: AppService) {}

  @Get('/hello')
  async getHello() {
    return Result.success(await this.prisma.users.findMany());
  }
}
