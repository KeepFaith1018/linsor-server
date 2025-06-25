import {
  Body,
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import { FileService } from './file.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/common/guards/jwtGuard.guard';
import { User } from 'src/common/decorators/user.decorator';
import { QueryFilesDto } from './dto/query-files.dto';
import { SearchFilesDto } from './dto/search-files.dto';

@Controller('file')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  // 上传文件
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('knowledge_id') Knowledge: string,
    @Body('file_name') fileName: string,
    @User() userId: number,
  ) {
    return await this.fileService.uploadFile(
      file,
      Number(Knowledge),
      userId,
      fileName,
    );
  }

  // 查询知识库中的文件
  @Get('list')
  async getFiles(@Param() dto: QueryFilesDto, @User() userId: number) {
    return await this.fileService.getFiles(dto, userId);
  }

  // 搜索知识库中的文件
  @Get('search')
  async searchFiles(@Query() dto: SearchFilesDto, @User() userId: number) {
    dto.knowledge_id = Number(dto.knowledge_id);
    dto.page = Number(dto.page);
    dto.limit = Number(dto.limit);
    return await this.fileService.searchFiles(dto, userId);
  }

  // 删除文件
  @Delete()
  async deleteFile(
    @Body('file_id', ParseIntPipe) fileId: number,
    @Body('knowledge_id', ParseIntPipe) knowledgeId: number,
    @User() userId: number,
  ) {
    return await this.fileService.deleteFile(knowledgeId, fileId, userId);
  }
}
