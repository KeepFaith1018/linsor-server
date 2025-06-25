import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiModule } from '../ai/ai.module';
import { ConversationGateway } from './conversation.gateway';

@Module({
  imports: [AiModule],
  controllers: [ConversationController],
  providers: [ConversationService, PrismaService, ConversationGateway],
  exports: [ConversationService],
})
export class ConversationModule {}
