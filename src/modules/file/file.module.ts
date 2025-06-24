import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

import * as path from 'path';
import * as fs from 'fs';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = 'uploads/';
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);

          // 生成保存到文件夹下的唯一文件名
          const name = `${Date.now()}-${Math.random().toString(36).substring(2)}${ext}`;
          cb(null, name);
        },
      }),
    }),
    AiModule,
  ],
  controllers: [FileController],
  providers: [FileService],
})
export class FileModule {}
