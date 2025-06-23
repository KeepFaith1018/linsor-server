import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  // 创建知识库
  async create(createKnowledgeDto: CreateKnowledgeDto, userId: number) {
    try {
      const knowledge = await this.prisma.knowledge.create({
        data: {
          name: createKnowledgeDto.name,
          description: createKnowledgeDto.description,
          is_shared: createKnowledgeDto.is_shared || false,
          owner_id: userId,
        },
      });

      return knowledge;
    } catch (error) {
      throw new HttpException(
        '创建知识库失败: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 查询知识库列表
  async findAll(queryDto: QueryKnowledgeDto, userId: number) {
    try {
      // 构建查询条件
      const where: any = {
        is_deleted:
          queryDto.is_deleted !== undefined ? queryDto.is_deleted : false,
      };

      // 如果提供了名称，进行模糊查询
      if (queryDto.name) {
        where.name = {
          contains: queryDto.name,
          mode: 'insensitive', // 不区分大小写
        };
      }

      // 如果指定了公开性
      if (queryDto.is_shared !== undefined) {
        where.is_shared = queryDto.is_shared;
      }

      // 如果指定了所有者ID
      if (queryDto.owner_id) {
        where.owner_id = queryDto.owner_id;
      }

      // 查询用户有权限访问的知识库
      // 1. 用户创建的知识库
      // 2. 公开的知识库
      // 3. 用户被邀请加入的知识库
      const knowledgeList = await this.prisma.knowledge.findMany({
        where: {
          OR: [
            { ...where, owner_id: userId }, // 用户创建的
            { ...where, is_shared: true }, // 公开的
            {
              // 用户被邀请的
              ...where,
              knowledge_user: {
                some: {
                  user_id: userId,
                },
              },
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
              conversations: true,
            },
          },
        },
        orderBy: {
          updated_at: 'desc',
        },
      });

      // 格式化返回结果
      return knowledgeList.map((knowledge) => ({
        id: knowledge.id,
        name: knowledge.name,
        description: knowledge.description,
        is_shared: knowledge.is_shared,
        created_at: knowledge.created_at,
        updated_at: knowledge.updated_at,
        owner: knowledge.users,
        members: knowledge.knowledge_user.map((ku) => ku.users),
        file_count: knowledge._count.files,
        conversation_count: knowledge._count.conversations,
        is_owner: knowledge.owner_id === userId,
        is_member: knowledge.knowledge_user.some((ku) => ku.user_id === userId),
      }));
    } catch (error) {
      throw new HttpException(
        '查询知识库失败: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 查询单个知识库
  async findOne(id: number, userId: number) {
    try {
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
        throw new HttpException('知识库不存在', HttpStatus.NOT_FOUND);
      }

      // 检查用户是否有权限访问该知识库
      const hasAccess =
        knowledge.owner_id === userId || // 是所有者
        knowledge.is_shared || // 是公开的
        knowledge.knowledge_user.some((ku) => ku.user_id === userId); // 是成员

      if (!hasAccess) {
        throw new HttpException('无权访问该知识库', HttpStatus.FORBIDDEN);
      }

      return {
        id: knowledge.id,
        name: knowledge.name,
        description: knowledge.description,
        is_shared: knowledge.is_shared,
        created_at: knowledge.created_at,
        updated_at: knowledge.updated_at,
        owner: knowledge.users,
        members: knowledge.knowledge_user.map((ku) => ku.users),
        files: knowledge.files,
        file_count: knowledge._count.files,
        conversation_count: knowledge._count.conversations,
        is_owner: knowledge.owner_id === userId,
        is_member: knowledge.knowledge_user.some((ku) => ku.user_id === userId),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '查询知识库详情失败: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 更新知识库
  async update(
    id: number,
    updateKnowledgeDto: UpdateKnowledgeDto,
    userId: number,
  ) {
    try {
      // 检查知识库是否存在
      const knowledge = await this.prisma.knowledge.findUnique({
        where: { id },
      });

      if (!knowledge) {
        throw new HttpException('知识库不存在', HttpStatus.NOT_FOUND);
      }

      // 检查是否是知识库所有者
      if (knowledge.owner_id !== userId) {
        throw new HttpException(
          '只有知识库所有者才能更新知识库',
          HttpStatus.FORBIDDEN,
        );
      }

      // 更新知识库
      const updatedKnowledge = await this.prisma.knowledge.update({
        where: { id },
        data: {
          name: updateKnowledgeDto.name,
          description: updateKnowledgeDto.description,
          is_shared: updateKnowledgeDto.is_shared,
          updated_at: new Date(),
        },
      });

      return updatedKnowledge;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '更新知识库失败: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 删除知识库（软删除）
  async remove(id: number, userId: number) {
    try {
      // 检查知识库是否存在
      const knowledge = await this.prisma.knowledge.findUnique({
        where: { id },
      });

      if (!knowledge) {
        throw new HttpException('知识库不存在', HttpStatus.NOT_FOUND);
      }

      // 检查是否是知识库所有者
      if (knowledge.owner_id !== userId) {
        throw new HttpException(
          '只有知识库所有者才能删除知识库',
          HttpStatus.FORBIDDEN,
        );
      }

      // 软删除知识库
      const deletedKnowledge = await this.prisma.knowledge.update({
        where: { id },
        data: {
          is_deleted: true,
          updated_at: new Date(),
        },
      });

      return deletedKnowledge;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '删除知识库失败: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 加入知识库
  async joinKnowledge(knowledgeId: number, userId: number) {
    try {
      // 检查知识库是否存在
      const knowledge = await this.prisma.knowledge.findUnique({
        where: { id: knowledgeId },
      });

      if (!knowledge) {
        throw new HttpException('知识库不存在', HttpStatus.NOT_FOUND);
      }

      // 检查知识库是否公开
      if (!knowledge.is_shared) {
        throw new HttpException(
          '该知识库不是公开的，无法加入',
          HttpStatus.FORBIDDEN,
        );
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
        throw new HttpException(
          '您已经是该知识库的成员',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 添加用户到知识库
      await this.prisma.knowledge_user.create({
        data: {
          knowledge_id: knowledgeId,
          user_id: userId,
        },
      });

      return { message: '成功加入知识库' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '加入知识库失败: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 退出知识库
  async leaveKnowledge(knowledgeId: number, userId: number) {
    try {
      // 检查知识库是否存在
      const knowledge = await this.prisma.knowledge.findUnique({
        where: { id: knowledgeId },
      });

      if (!knowledge) {
        throw new HttpException('知识库不存在', HttpStatus.NOT_FOUND);
      }

      // 检查用户是否是知识库所有者
      if (knowledge.owner_id === userId) {
        throw new HttpException(
          '知识库所有者不能退出知识库',
          HttpStatus.BAD_REQUEST,
        );
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
        throw new HttpException('您不是该知识库的成员', HttpStatus.BAD_REQUEST);
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
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '退出知识库失败: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 邀请用户加入知识库
  async inviteUser(
    knowledgeId: number,
    invitedUserId: number,
    currentUserId: number,
  ) {
    try {
      // 检查知识库是否存在
      const knowledge = await this.prisma.knowledge.findUnique({
        where: { id: knowledgeId },
      });

      if (!knowledge) {
        throw new HttpException('知识库不存在', HttpStatus.NOT_FOUND);
      }

      // 检查当前用户是否是知识库所有者
      if (knowledge.owner_id !== currentUserId) {
        throw new HttpException(
          '只有知识库所有者才能邀请用户',
          HttpStatus.FORBIDDEN,
        );
      }

      // 检查被邀请用户是否存在
      const invitedUser = await this.prisma.users.findUnique({
        where: { id: invitedUserId },
      });

      if (!invitedUser) {
        throw new HttpException('被邀请的用户不存在', HttpStatus.NOT_FOUND);
      }

      // 检查用户是否已经是知识库成员
      const existingMember = await this.prisma.knowledge_user.findUnique({
        where: {
          knowledge_id_user_id: {
            knowledge_id: knowledgeId,
            user_id: invitedUserId,
          },
        },
      });

      if (existingMember) {
        throw new HttpException(
          '该用户已经是知识库成员',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 添加用户到知识库
      await this.prisma.knowledge_user.create({
        data: {
          knowledge_id: knowledgeId,
          user_id: invitedUserId,
        },
      });

      return { message: '成功邀请用户加入知识库' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '邀请用户失败: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 移除知识库成员
  async removeMember(
    knowledgeId: number,
    memberId: number,
    currentUserId: number,
  ) {
    try {
      // 检查知识库是否存在
      const knowledge = await this.prisma.knowledge.findUnique({
        where: { id: knowledgeId },
      });

      if (!knowledge) {
        throw new HttpException('知识库不存在', HttpStatus.NOT_FOUND);
      }

      // 检查当前用户是否是知识库所有者
      if (knowledge.owner_id !== currentUserId) {
        throw new HttpException(
          '只有知识库所有者才能移除成员',
          HttpStatus.FORBIDDEN,
        );
      }

      // 检查被移除的用户是否是知识库成员
      const existingMember = await this.prisma.knowledge_user.findUnique({
        where: {
          knowledge_id_user_id: {
            knowledge_id: knowledgeId,
            user_id: memberId,
          },
        },
      });

      if (!existingMember) {
        throw new HttpException('该用户不是知识库成员', HttpStatus.BAD_REQUEST);
      }

      // 从知识库中移除用户
      await this.prisma.knowledge_user.delete({
        where: {
          knowledge_id_user_id: {
            knowledge_id: knowledgeId,
            user_id: memberId,
          },
        },
      });

      return { message: '成功移除知识库成员' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '移除成员失败: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
