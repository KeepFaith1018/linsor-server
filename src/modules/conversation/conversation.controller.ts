import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

import { SendMessageSimpleDto } from './dto/send-message-simple.dto';
import { QueryConversationDto } from './dto/query-conversation.dto';
import { JwtAuthGuard } from 'src/common/guards/jwtGuard.guard';
import { User } from 'src/common/decorators/user.decorator';
import { SaveStreamAiMessageDto } from './dto/save-stream-ai-message.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('会话模块')
@UseGuards(JwtAuthGuard)
@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  // 获取会话详情（没有则创建新会话）
  @ApiOperation({
    summary: '获取会话详情',
    description: '',
  })
  @Get('detail')
  async getConversationDetail(
    @Query('knowledge_id') knowledge_id: string,
    @User() userId: number,
  ) {
    const knowledgeId = knowledge_id ? Number(knowledge_id) : undefined;
    const result = await this.conversationService.getConversationDetail(
      knowledgeId,
      userId,
    );
    return result;
  }

  // 发送消息
  @ApiOperation({
    summary: '发送消息',
    description: '',
  })
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

  // 保存AI消息
  @ApiOperation({
    summary: '保存AI消息',
    description: '',
  })
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
  @ApiOperation({
    summary: '创建新对话',
    description: '',
  })
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
  @ApiOperation({
    summary: '获取对话列表',
    description: '',
  })
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
  @ApiOperation({
    summary: '获取对话详情',
    description: '',
  })
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
  @ApiOperation({
    summary: '删除对话',
    description: '',
  })
  @Delete(':id')
  async deleteConversation(@Param('id') id: string, @User() userId: number) {
    const result = await this.conversationService.deleteConversation(
      parseInt(id),
      userId,
    );
    return result;
  }
}
