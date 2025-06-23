import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { PrismaService } from '../../common/db/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: 'linsor',
      signOptions: {
        expiresIn: '7d',
      },
    }),
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, PrismaService],
})
export class KnowledgeModule {}
