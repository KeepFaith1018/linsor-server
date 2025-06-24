import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Put,
} from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { JwtAuthGuard } from 'src/common/guards/jwtGuard.guard';
import { User } from 'src/common/decorators/user.decorator';

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @UseGuards(JwtAuthGuard)
  // 查询个人知识库
  @Get('personal')
  async findPersonal(@User() userId: number) {
    return this.knowledgeService.findPersonal(userId);
  }

  @UseGuards(JwtAuthGuard)
  // 创建知识库
  @Post('create')
  async create(
    @Body() createKnowledgeDto: CreateKnowledgeDto,
    @User() userId: number,
  ) {
    return this.knowledgeService.create(createKnowledgeDto, userId);
  }

  // 查询知识库列表(共享的)
  @Get('list')
  async findAll(@Param() queryDto: QueryKnowledgeDto) {
    return this.knowledgeService.findAll(queryDto);
  }

  // 查询单个知识库
  @Get(':id')
  async findOne(@Param('id') id: string, @User() userId: number) {
    return this.knowledgeService.findOne(+id, userId);
  }
  @UseGuards(JwtAuthGuard)
  // 更新知识库
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateKnowledgeDto: UpdateKnowledgeDto,
    @User() userId: number,
  ) {
    return this.knowledgeService.update(+id, updateKnowledgeDto, userId);
  }
  @UseGuards(JwtAuthGuard)
  // 删除知识库
  @Delete(':id')
  async remove(@Param('id') id: string, @User() userId: number) {
    return this.knowledgeService.remove(+id, userId);
  }
  @UseGuards(JwtAuthGuard)
  // 加入知识库
  @Post('join/:id')
  async joinKnowledge(@Param('id') id: string, @User() userId: number) {
    return this.knowledgeService.joinKnowledge(+id, userId);
  }
  @UseGuards(JwtAuthGuard)
  // 退出知识库
  @Post('leave/:id')
  async leaveKnowledge(@Param('id') id: string, @User() userId: number) {
    return this.knowledgeService.leaveKnowledge(+id, userId);
  }
  @UseGuards(JwtAuthGuard)
  // 移除知识库成员
  @Delete('member/:id/:userId')
  async removeMember(
    @Param('id') id: string,
    @Param('userId') memberId: string,
    @User() currentUserId: number,
  ) {
    return this.knowledgeService.removeMember(+id, +memberId, currentUserId);
  }
}
