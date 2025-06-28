import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QueryFilesDto } from './dto/query-files.dto';
import { SearchFilesDto } from './dto/search-files.dto';
import * as fs from 'fs/promises';
import { AiService } from '../ai/ai.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppException } from 'src/common/exception/appException';
import { ErrorCode } from 'src/common/utils/errorCodes';

@Injectable()
export class FileService {
  // 在FileService中添加AI服务依赖
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger,
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

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

      // 创建文件记录
      const type = fileName.split('.').pop()?.toLocaleUpperCase();
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

      await this.aiService.processFileForVector(
        knowledge_id,
        fileRecord.id,
        fileRecord.file_url,
        {},
      );
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
      const localPath = file.path;
      try {
        if (localPath) {
          await fs.access(localPath); // 检查文件是否存在
          await fs.unlink(localPath); // 删除文件
        }
      } catch (err) {
        throw new Error('删除本地文件失败' + err);
      }
      throw error;
    }
  }

  // 查询知识库中的文件
  async getFiles(dto: QueryFilesDto, userId: number) {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;
    dto.knowledge_id = Number(dto.knowledge_id);

    // 验证知识库访问权限
    await this.validateKnowledgeAccess(dto.knowledge_id, userId);

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
  }

  // 搜索知识库中的文件
  async searchFiles(dto: SearchFilesDto, userId: number) {
    // 验证知识库权限
    await this.validateKnowledgeAccess(dto.knowledge_id, userId);
    const { page = 1, limit = 20, filename } = dto;
    const skip = (page - 1) * limit;
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
  }

  // 删除文件
  async deleteFile(knowledgeId: number, fileId: number, userId: number) {
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
      throw new AppException(ErrorCode.FILE_NOT_FOUND);
    }

    // 验证知识库权限
    await this.validateKnowledgeAccess(file.knowledge_id, userId);

    // 逻辑删除文件记录
    await this.prisma.files.update({
      where: { id: fileId },
      data: { is_deleted: true },
    });
    const localPath = file.file_url.replace('static', 'uploads');
    // 删除本地文件
    try {
      if (localPath) {
        await fs.access(localPath); // 检查文件是否存在
        await fs.unlink(localPath); // 删除文件
      }
    } catch (err) {
      this.logger.error(`删除本地文件失败: ${localPath}`, err);
    }

    await this.aiService.removeFileFromVector(knowledgeId, fileId);

    return { message: '文件删除成功' };
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
      throw new AppException(ErrorCode.KNOWLEDGE_UNAUTHORIZED);
    }
    return knowledge;
  }
}
