import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryConversationDto } from './dto/query-conversation.dto';
import { Result } from '../../common/utils/result';
import { JwtAuthGuard } from 'src/common/guards/jwtGuard.guard';
import { User } from 'src/common/decorators/user.decorator';
@UseGuards(JwtAuthGuard)
@Controller('conversation')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly jwtService: JwtService,
  ) {}

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
    return Result.success(result);
  }

  // 发送消息
  @Post('message')
  async sendMessage(
    @Body() sendMessageDto: SendMessageDto,
    @User() userId: number,
  ) {
    const result = await this.conversationService.sendMessage(
      sendMessageDto,
      userId,
    );
    return Result.success(result);
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
    return Result.success(result);
  }

  // 获取对话详情
  @Get(':id')
  async getConversationDetail(@Param('id') id: string, @User() userId: number) {
    const result = await this.conversationService.getConversationDetail(
      parseInt(id),
      userId,
    );
    return Result.success(result);
  }

  // 删除对话
  @Delete(':id')
  async deleteConversation(@Param('id') id: string, @User() userId: number) {
    const result = await this.conversationService.deleteConversation(
      parseInt(id),
      userId,
    );
    return Result.success(result);
  }

  // 删除消息
  @Delete('message/:id')
  async deleteMessage(@Param('id') id: string, @User() userId: number) {
    const result = await this.conversationService.deleteMessage(
      parseInt(id),
      userId,
    );
    return Result.success(result);
  }
}
