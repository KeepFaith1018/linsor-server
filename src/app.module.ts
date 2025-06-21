import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/config/winston.config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './common/db/prisma.service';

@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig),
    JwtModule.register({
      secret: 'linsor',
      signOptions: {
        expiresIn: '7d',
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
