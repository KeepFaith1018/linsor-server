import {
  Body,
  Controller,
  Post,
  Get,
  Delete,
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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
@ApiTags('文件')
@Controller('file')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  // 上传文件
  @ApiOperation({
    summary: '上传文件',
    description: '',
  })
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
  @ApiOperation({
    summary: '查询文件',
    description: '',
  })
  @Get('list')
  async getFiles(@Query() dto: QueryFilesDto, @User() userId: number) {
    return await this.fileService.getFiles(dto, userId);
  }

  // 搜索知识库中的文件
  @ApiOperation({
    summary: '搜索文件',
    description: '',
  })
  @Get('search')
  async searchFiles(@Query() dto: SearchFilesDto, @User() userId: number) {
    dto.knowledge_id = Number(dto.knowledge_id);
    dto.page = Number(dto.page);
    dto.limit = Number(dto.limit);
    return await this.fileService.searchFiles(dto, userId);
  }

  // 删除文件
  @ApiOperation({
    summary: '删除文件',
    description: '',
  })
  @Delete()
  async deleteFile(
    @Body('file_id', ParseIntPipe) fileId: number,
    @Body('knowledge_id', ParseIntPipe) knowledgeId: number,
    @User() userId: number,
  ) {
    return await this.fileService.deleteFile(knowledgeId, fileId, userId);
  }
}
