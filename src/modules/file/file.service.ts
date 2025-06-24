import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QueryFilesDto } from './dto/query-files.dto';
import { SearchFilesDto } from './dto/search-files.dto';
import * as fs from 'fs';
import { AiService } from '../ai/ai.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class FileService {
  // 在FileService中添加AI服务依赖
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger,
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  // 更新向量数据库相关方法
  private async addToVectorDatabase(
    knowledgeId: number,
    fileId: number,
    path: string,
    metadata: any = {},
  ) {
    try {
      return await this.aiService.processFileForVector(
        knowledgeId,
        fileId,
        path,
        metadata,
      );
    } catch (error) {
      this.logger.error(`Error adding to vector database: ${error.message}`);
      throw error;
    }
  }

  private async removeFromVectorDatabase(knowledgeId: number, fileId: number) {
    try {
      return await this.aiService.removeFileFromVector(knowledgeId, fileId);
    } catch (error) {
      this.logger.error(
        `Error removing from vector database: ${error.message}`,
      );
      throw error;
    }
  }

  // 上传文件
  async uploadFile(
    file: Express.Multer.File,
    knowledge_id: number,
    userId: number,
    fileName: string,
  ) {
    try {
      // 验证知识库权限
      await this.validateKnowledgeAccess(knowledge_id, userId);
      const type = fileName.split('.').pop()?.toLocaleUpperCase();
      // 创建文件记录
      const fileRecord = await this.prisma.files.create({
        data: {
          knowledge_id: knowledge_id,
          name: fileName,
          file_url: file.path.replace('uploads', 'static'),
          file_type: type,
        },
        include: {
          knowledge: {
            select: { id: true, name: true },
          },
        },
      });

      await this.addToVectorDatabase(knowledge_id, fileRecord.id, file.path);

      return {
        id: fileRecord.id,
        name: fileRecord.name,
        file_type: fileRecord.file_type,
        file_url: fileRecord.file_url,
        knowledge: fileRecord.knowledge,
        created_at: fileRecord.created_at,
      };
    } catch (error) {
      // 如果数据库操作失败，删除已上传的文件
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new HttpException(
        error.message || '文件上传失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 查询知识库中的文件
  async getFiles(dto: QueryFilesDto, userId: number) {
    try {
      // 验证知识库权限
      await this.validateKnowledgeAccess(dto.knowledge_id, userId);

      const { page = 1, limit = 20 } = dto;
      const skip = (page - 1) * limit;

      const where = {
        knowledge_id: dto.knowledge_id,
        is_deleted: false,
      };

      const [files, total] = await Promise.all([
        this.prisma.files.findMany({
          where,
          select: {
            id: true,
            name: true,
            file_type: true,
            file_url: true,
            created_at: true,
            updated_at: true,
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.files.count({ where }),
      ]);

      return {
        files,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new HttpException(
        error.message || '查询文件失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 搜索知识库中的文件
  async searchFiles(dto: SearchFilesDto, userId: number) {
    try {
      // 验证知识库权限
      await this.validateKnowledgeAccess(dto.knowledge_id, userId);
      console.log(dto);
      const { page = 1, limit = 20, filename } = dto;
      const skip = (page - 1) * limit;

      console.log('---------------------' + filename);

      const where = {
        knowledge_id: Number(dto.knowledge_id),
        is_deleted: false,
        name: {
          contains: filename,
          mode: 'insensitive' as const, // 不区分大小写
        },
      };

      const [files, total] = await Promise.all([
        this.prisma.files.findMany({
          where,
          select: {
            id: true,
            name: true,
            file_type: true,
            file_url: true,
            created_at: true,
            updated_at: true,
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.files.count({ where }),
      ]);

      return {
        files,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        searchTerm: filename,
      };
    } catch (error) {
      throw new HttpException(
        error.message || '搜索文件失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 删除文件
  async deleteFile(knowledgeId: number, fileId: number, userId: number) {
    try {
      // 查找文件记录
      const file = await this.prisma.files.findFirst({
        where: {
          id: fileId,
          is_deleted: false,
        },
        include: {
          knowledge: true,
        },
      });

      if (!file) {
        throw new HttpException('文件不存在', HttpStatus.NOT_FOUND);
      }

      // 验证知识库权限
      await this.validateKnowledgeAccess(file.knowledge_id, userId);

      // 逻辑删除文件记录
      await this.prisma.files.update({
        where: { id: fileId },
        data: { is_deleted: true },
      });

      // 删除本地文件
      if (file.file_url && fs.existsSync(file.file_url)) {
        fs.unlinkSync(file.file_url);
      }

      // 从向量数据库删除（预留实现）
      await this.removeFromVectorDatabase(knowledgeId, fileId);

      return { message: '文件删除成功' };
    } catch (error) {
      throw new HttpException(
        error.message || '删除文件失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 验证知识库访问权限
  private async validateKnowledgeAccess(knowledgeId: number, userId: number) {
    const knowledge = await this.prisma.knowledge.findFirst({
      where: {
        id: knowledgeId,
        is_deleted: false,
        OR: [
          { owner_id: userId },
          {
            knowledge_user: {
              some: { user_id: userId },
            },
          },
          { is_shared: true },
        ],
      },
    });

    if (!knowledge) {
      throw new HttpException('知识库不存在或无访问权限', HttpStatus.FORBIDDEN);
    }

    return knowledge;
  }
}
