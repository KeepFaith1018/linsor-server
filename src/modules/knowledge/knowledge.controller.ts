import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { JwtService } from '@nestjs/jwt';

@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly jwtService: JwtService,
  ) {}

  // 获取用户ID
  private getUserIdFromToken(authorization: string): number {
    if (!authorization) {
      throw new HttpException('缺少Authorization头', HttpStatus.UNAUTHORIZED);
    }

    const token = authorization.replace('Bearer ', '');
    try {
      const payload = this.jwtService.verify(token);
      return payload.userId;
    } catch (error) {
      throw new HttpException('Token无效', HttpStatus.UNAUTHORIZED);
    }
  }

  // 创建知识库
  @Post()
  async create(
    @Body() createKnowledgeDto: CreateKnowledgeDto,
    @Headers('authorization') authorization: string,
  ) {
    const userId = this.getUserIdFromToken(authorization);
    return this.knowledgeService.create(createKnowledgeDto, userId);
  }

  // 查询知识库列表
  @Get()
  async findAll(
    @Query() queryDto: QueryKnowledgeDto,
    @Headers('authorization') authorization: string,
  ) {
    const userId = this.getUserIdFromToken(authorization);
    return this.knowledgeService.findAll(queryDto, userId);
  }

  // 查询单个知识库
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('authorization') authorization: string,
  ) {
    const userId = this.getUserIdFromToken(authorization);
    return this.knowledgeService.findOne(+id, userId);
  }

  // 更新知识库
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateKnowledgeDto: UpdateKnowledgeDto,
    @Headers('authorization') authorization: string,
  ) {
    const userId = this.getUserIdFromToken(authorization);
    return this.knowledgeService.update(+id, updateKnowledgeDto, userId);
  }

  // 删除知识库
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Headers('authorization') authorization: string,
  ) {
    const userId = this.getUserIdFromToken(authorization);
    return this.knowledgeService.remove(+id, userId);
  }

  // 加入知识库
  @Post('join/:id')
  async joinKnowledge(
    @Param('id') id: string,
    @Headers('authorization') authorization: string,
  ) {
    const userId = this.getUserIdFromToken(authorization);
    return this.knowledgeService.joinKnowledge(+id, userId);
  }

  // 退出知识库
  @Post('leave/:id')
  async leaveKnowledge(
    @Param('id') id: string,
    @Headers('authorization') authorization: string,
  ) {
    const userId = this.getUserIdFromToken(authorization);
    return this.knowledgeService.leaveKnowledge(+id, userId);
  }

  // 邀请用户加入知识库
  @Post('invite/:id/:userId')
  async inviteUser(
    @Param('id') id: string,
    @Param('userId') invitedUserId: string,
    @Headers('authorization') authorization: string,
  ) {
    const currentUserId = this.getUserIdFromToken(authorization);
    return this.knowledgeService.inviteUser(+id, +invitedUserId, currentUserId);
  }

  // 移除知识库成员
  @Delete('member/:id/:userId')
  async removeMember(
    @Param('id') id: string,
    @Param('userId') memberId: string,
    @Headers('authorization') authorization: string,
  ) {
    const currentUserId = this.getUserIdFromToken(authorization);
    return this.knowledgeService.removeMember(+id, +memberId, currentUserId);
  }
}
