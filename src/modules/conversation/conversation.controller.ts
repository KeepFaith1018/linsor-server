import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

import { SendMessageSimpleDto } from './dto/send-message-simple.dto';
import { QueryConversationDto } from './dto/query-conversation.dto';
import { JwtAuthGuard } from 'src/common/guards/jwtGuard.guard';
import { User } from 'src/common/decorators/user.decorator';
import { SaveStreamAiMessageDto } from './dto/save-stream-ai-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  // 1. 获取会话详情（没有则创建新会话）
  @Get('detail')
  async getConversationDetail(
    @Query('knowledge_id') knowledge_id: string,
    @User() userId: number,
  ) {
    const result = await this.conversationService.getConversationDetail(
      Number(knowledge_id),
      userId,
    );
    return result;
  }

  // 2. 发送消息（普通回复）
  @Post('send-simple')
  async sendMessageSimple(
    @Body() dto: SendMessageSimpleDto,
    @User() userId: number,
  ) {
    const result = await this.conversationService.sendMessageSimple(
      dto,
      userId,
    );
    return result;
  }

  // 3. 保存AI消息
  // @Post('save-ai-message')
  // async saveAiMessage(@Body() dto: SaveAiMessageDto, @User() userId: number) {
  //   const result = await this.conversationService.saveAiMessage(dto, userId);
  //   return result;
  // }

  // 保存流式AI消息
  @Post('message/save')
  async saveStreamAiMessage(
    @Body() dto: SaveStreamAiMessageDto,
    @User() userId: number,
  ) {
    const result = await this.conversationService.saveStreamAiMessage(
      dto,
      userId,
    );
    return result;
  }

  // 创建新对话
  @Post()
  async createConversation(
    @Body() createConversationDto: CreateConversationDto,
    @User() userId: number,
  ) {
    const result = await this.conversationService.createConversation(
      createConversationDto,
      userId,
    );
    return result;
  }

  // 获取对话列表
  @Get()
  async getConversations(
    @Query() queryDto: QueryConversationDto,
    @User() userId: number,
  ) {
    const result = await this.conversationService.getConversations(
      queryDto,
      userId,
    );
    return result;
  }

  // 获取对话详情
  @Get(':id')
  async getConversationDetailById(
    @Param('id') id: string,
    @User() userId: number,
  ) {
    const result = await this.conversationService.getConversationDetail(
      parseInt(id),
      userId,
    );
    return result;
  }

  // 删除对话
  @Delete(':id')
  async deleteConversation(@Param('id') id: string, @User() userId: number) {
    const result = await this.conversationService.deleteConversation(
      parseInt(id),
      userId,
    );
    return result;
  }

  // 删除消息
  @Delete('message/:id')
  async deleteMessage(@Param('id') id: string, @User() userId: number) {
    const result = await this.conversationService.deleteMessage(
      parseInt(id),
      userId,
    );
    return result;
  }

  // SSE流式AI响应
  @Post('stream-ai-response')
  @Sse('stream-ai-response')
  streamAiResponse(
    @Body() dto: { conversation_id: number; user_message: string },
    @User() userId: number,
  ): Observable<MessageEvent> {
    return new Observable((observer) => {
      (async () => {
        try {
          console.log(
            `[${new Date().toISOString()}] 🔄 开始SSE流式响应，会话ID: ${dto.conversation_id}`,
          );

          const generator = this.conversationService.generateStreamAiResponse(
            dto.conversation_id,
            dto.user_message,
            userId,
          );

          for await (const chunk of generator) {
            observer.next({
              data: {
                type: 'token',
                content: chunk,
                timestamp: new Date().toISOString(),
              },
            });
          }

          // 发送完成信号
          observer.next({
            data: {
              type: 'done',
              content: '',
              timestamp: new Date().toISOString(),
            },
          });

          observer.complete();
          console.log(
            `[${new Date().toISOString()}] ✅ SSE流式响应完成，会话ID: ${dto.conversation_id}`,
          );
        } catch (error) {
          console.error(`SSE流式响应错误: ${error.message}`);
          observer.next({
            data: {
              type: 'error',
              content: error.message,
              timestamp: new Date().toISOString(),
            },
          });
          observer.error(error);
        }
      })();
    });
  }
}
