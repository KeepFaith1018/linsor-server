import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/config/winston.config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PrismaService } from './common/db/prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { FileModule } from './modules/file/file.module';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filter/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig),
    JwtModule.register({
      secret: 'linsor',
      signOptions: {
        expiresIn: '7d',
      },
    }),
    AuthModule,
    KnowledgeModule,
    FileModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    JwtService,
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
})
export class AppModule {}
