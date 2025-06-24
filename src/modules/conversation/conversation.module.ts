import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule], // 添加AiModule
  controllers: [ConversationController],
  providers: [ConversationService, PrismaService],
  exports: [ConversationService],
})
export class ConversationModule {}
