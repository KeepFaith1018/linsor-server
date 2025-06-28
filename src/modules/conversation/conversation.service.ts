import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageSimpleDto } from './dto/send-message-simple.dto';
import { QueryConversationDto } from './dto/query-conversation.dto';
import { AiService } from '../ai/ai.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { SaveStreamAiMessageDto } from './dto/save-stream-ai-message.dto';
import { AppException } from 'src/common/exception/appException';
import { ErrorCode } from 'src/common/utils/errorCodes';

@Injectable()
export class ConversationService {
  @Inject(WINSTON_MODULE_NEST_PROVIDER)
  private readonly logger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  //  获取会话详情
  async getConversationDetail(
    knowledge_id: number | undefined,
    userId: number,
  ) {
    // 查找现有会话
    let conversation = await this.prisma.conversations.findFirst({
      where: {
        user_id: userId,
        type: knowledge_id ? 'knowledge' : 'global',
        is_deleted: false,
        knowledge_id: knowledge_id || null,
      },
      include: {
        knowledge: {
          select: { id: true, name: true },
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    // 如果没有找到会话，创建新会话
    if (!conversation) {
      conversation = await this.prisma.conversations.create({
        data: {
          user_id: userId,
          knowledge_id: knowledge_id || null,
          type: knowledge_id ? 'knowledge' : 'global',
          title: knowledge_id ? '知识库对话' : '全网对话',
        },
        include: {
          knowledge: {
            select: { id: true, name: true },
          },
        },
      });
    }

    // 获取该会话下的消息列表
    const messages = await this.prisma.messages.findMany({
      where: {
        conversation_id: conversation.id,
      },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        content: true,
        sender_type: true,
        isSuccess: true,
        created_at: true,
      },
    });

    return {
      conversation,
      messages,
      isNew: !conversation.id, // 标识是否为新创建的会话
    };
  }

  //  用户发送保存消息
  async sendMessageSimple(dto: SendMessageSimpleDto, userId: number) {
    // 1. 验证会话权限
    const conversation = await this.prisma.conversations.findUnique({
      where: {
        id: dto.conversation_id,
        user_id: userId,
      },
    });

    if (!conversation) {
      throw new AppException(ErrorCode.CONVERSATION_NOT_FOUND);
    }

    // 2. 保存用户消息并返回
    const userMessage = await this.prisma.messages.create({
      data: {
        conversation_id: dto.conversation_id,
        sender_type: 'user',
        content: dto.content,
        isSuccess: true,
      },
    });

    // 立即返回用户消息，不等待AI响应
    return {
      userMessage,
      conversationId: dto.conversation_id,
    };
  }

  // 流式AI响应方法
  async *generateStreamAiResponse(
    conversationId: number,
    userMessage: string,
    userId: number,
  ): AsyncGenerator<string, void, unknown> {
    // 1. 验证会话权限
    const conversation = await this.prisma.conversations.findUnique({
      where: {
        id: conversationId,
        user_id: userId,
      },
    });
    if (!conversation) {
      throw new AppException(ErrorCode.CONVERSATION_UNAUTHORIZED);
    }

    // 2. 获取对话历史
    const recentMessages = await this.prisma.messages.findMany({
      where: {
        conversation_id: conversationId,
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    // 3. 调用AI服务生成流式响应
    let streamGenerator;
    if (conversation.type === 'knowledge') {
      streamGenerator = this.aiService.generateKnowledgeStreamResponse(
        userMessage,
        conversation.knowledge_id!,
        recentMessages,
      );
    } else {
      streamGenerator = this.aiService.generateGlobalStreamResponse(
        userMessage,
        recentMessages,
      );
    }

    // 4. 逐步yield AI响应
    for await (const chunk of streamGenerator) {
      yield chunk;
    }
  }

  // 保存AI消息
  async saveStreamAiMessage(dto: SaveStreamAiMessageDto, userId: number) {
    // 验证对话权限
    await this.validateConversationAccess(dto.conversation_id, userId);

    // 保存AI回复到数据库
    const aiMessage = await this.prisma.messages.create({
      data: {
        conversation_id: dto.conversation_id,
        sender_type: 'ai',
        content: dto.content,
        isSuccess: dto.isSuccess, // 用户终止则标记为未成功
      },
    });

    // 更新对话时间
    await this.prisma.conversations.update({
      where: { id: dto.conversation_id },
      data: { updated_at: new Date() },
    });

    return {
      message: !dto.isSuccess ? 'AI消息已终止并保存' : 'AI消息保存成功',
      aiMessage,
    };
  }

  // 创建新对话
  async createConversation(dto: CreateConversationDto, userId: number) {
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
        title: dto.title || '',
      },
      include: {
        knowledge: {
          select: { id: true, name: true },
        },
      },
    });
    return conversation;
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
            where: {},
            orderBy: { created_at: 'desc' },
            take: 1,
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
      throw new AppException(ErrorCode.MESSAGE_NOT_FOUND);
    }

    if (message.conversations.user_id !== userId) {
      throw new AppException(ErrorCode.MESSAGE_UNAUTHORIZED);
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
      throw new AppException(ErrorCode.KNOWLEDGE_UNAUTHORIZED);
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
      throw new AppException(ErrorCode.CONVERSATION_UNAUTHORIZED);
    }

    return conversation;
  }
}
