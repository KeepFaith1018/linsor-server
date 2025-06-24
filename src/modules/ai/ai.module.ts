import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { VectorService } from './vector.service';
import { AiService } from './ai.service';

@Module({
  imports: [PrismaModule],
  providers: [AiService, VectorService],
  exports: [AiService, VectorService],
})
export class AiModule {}
