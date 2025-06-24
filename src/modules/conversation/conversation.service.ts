import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryConversationDto } from './dto/query-conversation.dto';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  // 更新AI响应生成方法
  private async generateAIResponse(
    userMessage: string,
    conversationType: string,
    knowledgeId?: number,
    messageHistory?: any[],
  ): Promise<string> {
    if (conversationType === 'global') {
      return await this.aiService.generateGlobalResponse(
        userMessage,
        messageHistory,
      );
    } else {
      return await this.aiService.generateKnowledgeResponse(
        userMessage,
        knowledgeId!,
        messageHistory,
      );
    }
  }

  // 更新全网AI响应方法
  private async generateGlobalAIResponse(
    userMessage: string,
    messageHistory?: any[],
  ): Promise<string> {
    return await this.aiService.generateGlobalResponse(
      userMessage,
      messageHistory,
    );
  }

  // 更新知识库AI响应方法
  private async generateKnowledgeAIResponse(
    userMessage: string,
    knowledgeId?: number,
    messageHistory?: any[],
  ): Promise<string> {
    return await this.aiService.generateKnowledgeResponse(
      userMessage,
      knowledgeId!,
      messageHistory,
    );
  }

  // 创建新对话
  async createConversation(dto: CreateConversationDto, userId: number) {
    try {
      // 如果是知识库对话，验证知识库权限
      if (dto.type === 'knowledge' && dto.knowledge_id) {
        await this.validateKnowledgeAccess(dto.knowledge_id, userId);
      }

      // 创建对话
      const conversation = await this.prisma.conversations.create({
        data: {
          user_id: userId,
          knowledge_id: dto.knowledge_id,
          type: dto.type,
          title: dto.title || this.generateTitle(dto.first_message),
        },
        include: {
          knowledge: {
            select: { id: true, name: true },
          },
        },
      });

      // 添加用户的第一条消息
      const userMessage = await this.prisma.messages.create({
        data: {
          conversation_id: conversation.id,
          sender_type: 'user',
          content: dto.first_message,
        },
      });

      // 调用AI生成回复
      const aiResponse = await this.generateAIResponse(
        dto.first_message,
        dto.type,
        dto.knowledge_id,
      );

      // 保存AI回复
      const aiMessage = await this.prisma.messages.create({
        data: {
          conversation_id: conversation.id,
          sender_type: 'ai',
          content: aiResponse,
        },
      });

      return {
        conversation,
        messages: [userMessage, aiMessage],
      };
    } catch (error) {
      throw new HttpException(
        error.message || '创建对话失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 发送消息
  async sendMessage(dto: SendMessageDto, userId: number) {
    try {
      // 验证对话权限
      const conversation = await this.validateConversationAccess(
        dto.conversation_id,
        userId,
      );

      // 添加用户消息
      const userMessage = await this.prisma.messages.create({
        data: {
          conversation_id: dto.conversation_id,
          sender_type: 'user',
          content: dto.content,
        },
      });

      // 获取对话历史（最近10条消息用于上下文）
      const recentMessages = await this.prisma.messages.findMany({
        where: {
          conversation_id: dto.conversation_id,
        },
        orderBy: { created_at: 'desc' },
        take: 10,
      });

      // 调用AI生成回复
      const aiResponse = await this.generateAIResponse(
        dto.content,
        conversation.type,
        conversation.knowledge_id!,
        recentMessages,
      );

      // 保存AI回复
      const aiMessage = await this.prisma.messages.create({
        data: {
          conversation_id: dto.conversation_id,
          sender_type: 'ai',
          content: aiResponse,
        },
      });

      // 更新对话时间
      await this.prisma.conversations.update({
        where: { id: dto.conversation_id },
        data: { updated_at: new Date() },
      });

      return {
        userMessage,
        aiMessage,
      };
    } catch (error) {
      throw new HttpException(
        error.message || '发送消息失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 获取对话列表
  async getConversations(dto: QueryConversationDto, userId: number) {
    const { type, knowledge_id, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      user_id: userId,
      is_deleted: false,
    };

    if (type) {
      where.type = type;
    }

    if (knowledge_id) {
      where.knowledge_id = knowledge_id;
    }

    const [conversations, total] = await Promise.all([
      this.prisma.conversations.findMany({
        where,
        include: {
          knowledge: {
            select: { id: true, name: true },
          },
          messages: {
            where: {}, // 移除 is_deleted: false 条件
            orderBy: { created_at: 'desc' },
            take: 1, // 只获取最后一条消息
            select: {
              id: true,
              content: true,
              sender_type: true,
              created_at: true,
            },
          },
          _count: {
            select: {
              messages: {}, // 移除 where: { is_deleted: false } 条件
            },
          },
        },
        orderBy: { updated_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.conversations.count({ where }),
    ]);

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 获取对话详情和消息历史
  async getConversationDetail(conversationId: number, userId: number) {
    // 验证权限
    const conversation = await this.validateConversationAccess(
      conversationId,
      userId,
    );

    // 获取消息列表
    const messages = await this.prisma.messages.findMany({
      where: {
        conversation_id: conversationId,
        // 移除 is_deleted: false 条件
      },
      orderBy: { created_at: 'asc' },
    });

    return {
      conversation,
      messages,
    };
  }

  // 删除对话（逻辑删除）
  async deleteConversation(conversationId: number, userId: number) {
    // 验证权限
    await this.validateConversationAccess(conversationId, userId);

    // 只逻辑删除对话，不处理消息
    await this.prisma.conversations.update({
      where: { id: conversationId },
      data: { is_deleted: true },
    });

    // 删除该对话下的所有消息（物理删除）
    await this.prisma.messages.deleteMany({
      where: { conversation_id: conversationId },
    });

    return { message: '对话删除成功' };
  }

  // 删除单条消息（物理删除）
  async deleteMessage(messageId: number, userId: number) {
    const message = await this.prisma.messages.findUnique({
      where: { id: messageId },
      include: {
        conversations: true,
      },
    });

    if (!message) {
      throw new HttpException('消息不存在', HttpStatus.NOT_FOUND);
    }

    if (message.conversations.user_id !== userId) {
      throw new HttpException('无权限删除此消息', HttpStatus.FORBIDDEN);
    }

    // 物理删除消息
    await this.prisma.messages.delete({
      where: { id: messageId },
    });

    return { message: '消息删除成功' };
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

  // 验证对话访问权限
  private async validateConversationAccess(
    conversationId: number,
    userId: number,
  ) {
    const conversation = await this.prisma.conversations.findFirst({
      where: {
        id: conversationId,
        user_id: userId,
        is_deleted: false,
      },
      include: {
        knowledge: {
          select: { id: true, name: true },
        },
      },
    });

    if (!conversation) {
      throw new HttpException('对话不存在或无访问权限', HttpStatus.FORBIDDEN);
    }

    return conversation;
  }

  // 生成对话标题
  private generateTitle(firstMessage: string): string {
    // 简单的标题生成逻辑，取前20个字符
    return firstMessage.length > 20
      ? firstMessage.substring(0, 20) + '...'
      : firstMessage;
  }
}
