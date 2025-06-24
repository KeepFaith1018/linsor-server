import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/config/winston.config';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './modules/auth/auth.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { FileModule } from './modules/file/file.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filter/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwtGuard.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'), // 你存储上传文件的目录
      serveRoot: '/static', // 访问前缀，如：http://localhost:3000/static/xxx.jpg
    }),
    WinstonModule.forRoot(winstonConfig),
    JwtModule.register({
      global: true,
      secret: 'linsor',
      signOptions: {
        expiresIn: '7d',
      },
    }),
    AuthModule,
    KnowledgeModule,
    FileModule,
    ConversationModule, // 新增
    PrismaModule,
    AiModule, // 添加AiModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtAuthGuard,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // 应用拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  exports: [JwtAuthGuard],
})
export class AppModule {}
