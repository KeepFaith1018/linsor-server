import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { AppException } from 'src/common/exception/appException';
import { ErrorCode } from 'src/common/utils/errorCodes';

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  // 查询个人加入的共享知识库
  async findJoined(userId: number) {
    const joinedKnowledges = await this.prisma.knowledge.findMany({
      where: {
        is_shared: true,
        knowledge_user: {
          some: {
            user_id: userId,
          },
        },
      },
    });
    return joinedKnowledges;
  }

  // 创建知识库
  async create(createKnowledgeDto: CreateKnowledgeDto, userId: number) {
    const knowledge = await this.prisma.knowledge.create({
      data: {
        name: createKnowledgeDto.name,
        avatar: createKnowledgeDto.avatar,
        description: createKnowledgeDto.description,
        is_shared: createKnowledgeDto.is_shared || false,
        owner_id: userId,
      },
    });
    return knowledge;
  }

  // 查询知识库列表,只能查询共享知识库
  async findAll(queryDto: QueryKnowledgeDto) {
    // 构建查询条件
    const where: any = {
      is_deleted: false,
      is_shared: true,
    };

    // 如果提供了名称，进行模糊查询
    if (queryDto.name) {
      where.name = {
        contains: queryDto.name,
        mode: 'insensitive', // 不区分大小写
      };
    }

    // 如果指定了所有者ID
    if (queryDto.owner_id) {
      where.owner_id = Number(queryDto.owner_id);
    }
    const pages: { skip?: number; take?: number } = {};

    if (queryDto.page && queryDto.page_size) {
      const page = Number(queryDto.page);
      const pageSize = Number(queryDto.page_size);
      pages.skip = (page - 1) * pageSize; // 正确的 offset
      pages.take = pageSize;
    }
    const knowledgeList = await this.prisma.knowledge.findMany({
      where: {
        OR: [
          {
            ...where,
          },
        ],
      },
      include: {
        users: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
        knowledge_user: {
          include: {
            users: {
              select: {
                id: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: {
            files: true,
          },
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
      ...pages,
    });

    // 格式化返回结果
    return knowledgeList.map((knowledge) => ({
      id: knowledge.id,
      name: knowledge.name,
      avatar: knowledge.avatar,
      description: knowledge.description,
      is_shared: knowledge.is_shared,
      owner_id: knowledge.owner_id,
      created_at: knowledge.created_at,
      updated_at: knowledge.updated_at,
      owner: knowledge.users,
      members: knowledge.knowledge_user.map((ku) => ku.users),
      file_count: knowledge._count.files,
    }));
  }

  // 查询单个知识库
  async findOne(id: number, userId: number) {
    const knowledge = await this.prisma.knowledge.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
        knowledge_user: {
          include: {
            users: {
              select: {
                id: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
        files: {
          where: {
            is_deleted: false,
          },
        },
        _count: {
          select: {
            files: true,
            conversations: true,
          },
        },
      },
    });

    if (!knowledge) {
      throw new AppException(ErrorCode.KNOWLEDGE_NOT_FOUND);
    }

    // 检查用户是否有权限访问该知识库
    const hasAccess =
      knowledge.owner_id === userId || // 是所有者
      knowledge.is_shared || // 是公开的
      knowledge.knowledge_user.some((ku) => ku.user_id === userId); // 是成员

    if (!hasAccess) {
      throw new AppException(ErrorCode.KNOWLEDGE_UNAUTHORIZED);
    }

    return {
      id: knowledge.id,
      name: knowledge.name,
      description: knowledge.description,
      is_shared: knowledge.is_shared,
      created_at: knowledge.created_at,
      updated_at: knowledge.updated_at,
      owner: knowledge.users,
      owner_id: knowledge.owner_id,
      members: knowledge.knowledge_user.map((ku) => ku.users),
      files: knowledge.files,
      file_count: knowledge._count.files,
      conversation_count: knowledge._count.conversations,
      is_owner: knowledge.owner_id === userId,
      is_member: knowledge.knowledge_user.some((ku) => ku.user_id === userId),
    };
  }

  async findPersonal(userId: number) {
    const knowledge = await this.prisma.knowledge.findFirst({
      where: {
        name: {
          contains: '个人知识库',
        },
        owner_id: userId,
        is_deleted: false,
      },
    });
    return knowledge;
  }

  // 加入知识库
  async joinKnowledge(knowledgeId: number, userId: number) {
    // 检查知识库是否存在
    const knowledge = await this.prisma.knowledge.findUnique({
      where: { id: knowledgeId },
    });

    if (!knowledge) {
      throw new AppException(ErrorCode.KNOWLEDGE_NOT_FOUND);
    }

    // 检查知识库是否公开
    if (!knowledge.is_shared) {
      throw new AppException(ErrorCode.KNOWLEDGE_NOT_SHARED);
    }

    // 检查用户是否已经是知识库成员
    const existingMember = await this.prisma.knowledge_user.findUnique({
      where: {
        knowledge_id_user_id: {
          knowledge_id: knowledgeId,
          user_id: userId,
        },
      },
    });

    if (existingMember) {
      throw new AppException(ErrorCode.KNOWLEDGE_HAS_JOINED);
    }

    // 添加用户到知识库
    await this.prisma.knowledge_user.create({
      data: {
        knowledge_id: knowledgeId,
        user_id: userId,
      },
    });

    return { message: '成功加入知识库' };
  }

  // 退出知识库
  async leaveKnowledge(knowledgeId: number, userId: number) {
    // 检查知识库是否存在
    const knowledge = await this.prisma.knowledge.findUnique({
      where: { id: knowledgeId },
    });

    if (!knowledge) {
      throw new AppException(ErrorCode.KNOWLEDGE_NOT_FOUND);
    }

    // 检查用户是否是知识库所有者
    if (knowledge.owner_id === userId) {
      throw new AppException(ErrorCode.KNOWLEDGE_HAS_OWNED);
    }

    // 检查用户是否是知识库成员
    const existingMember = await this.prisma.knowledge_user.findUnique({
      where: {
        knowledge_id_user_id: {
          knowledge_id: knowledgeId,
          user_id: userId,
        },
      },
    });

    if (!existingMember) {
      throw new AppException(ErrorCode.KNOWLEDGE_NOT_JOINED);
    }

    // 从知识库中移除用户
    await this.prisma.knowledge_user.delete({
      where: {
        knowledge_id_user_id: {
          knowledge_id: knowledgeId,
          user_id: userId,
        },
      },
    });

    return { message: '成功退出知识库' };
  }
}
