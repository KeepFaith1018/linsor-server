import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { JwtAuthGuard } from 'src/common/guards/jwtGuard.guard';
import { User } from 'src/common/decorators/user.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
@ApiTags('知识库')
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  // 查询个人知识库
  @ApiOperation({
    summary: '查询个人知识库',
    description: '',
  })
  @UseGuards(JwtAuthGuard)
  @Get('personal')
  async findPersonal(@User() userId: number) {
    return this.knowledgeService.findPersonal(userId);
  }

  // 查询个人加入的共享知识库列表
  @ApiOperation({
    summary: '查询个人加入的共享知识库',
    description: '',
  })
  @Get('joined')
  @UseGuards(JwtAuthGuard)
  async findJoined(@User() userId: number) {
    return this.knowledgeService.findJoined(userId);
  }

  // 创建知识库
  @ApiOperation({
    summary: '创建知识库',
    description: '',
  })
  @UseGuards(JwtAuthGuard)
  @Post('create')
  async create(
    @Body() createKnowledgeDto: CreateKnowledgeDto,
    @User() userId: number,
  ) {
    return this.knowledgeService.create(createKnowledgeDto, userId);
  }

  // 查询知识库列表(共享的)
  @ApiOperation({
    summary: '查询共享的知识库',
    description: '',
  })
  @Get('list')
  async findAll(@Query() queryDto: QueryKnowledgeDto) {
    return this.knowledgeService.findAll(queryDto);
  }

  // 查询单个知识库
  @ApiOperation({
    summary: '查询单独知识库',
    description: '',
  })
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @User() userId: number) {
    return this.knowledgeService.findOne(+id, userId);
  }
  // 加入知识库
  @ApiOperation({
    summary: '查询单独知识库',
    description: '',
  })
  @UseGuards(JwtAuthGuard)
  @Post('join/:id')
  async joinKnowledge(@Param('id') id: string, @User() userId: number) {
    return await this.knowledgeService.joinKnowledge(+id, userId);
  }
  // 退出知识库
  @ApiOperation({
    summary: '查询单独知识库',
    description: '',
  })
  @UseGuards(JwtAuthGuard)
  @Post('leave/:id')
  async leaveKnowledge(@Param('id') id: string, @User() userId: number) {
    return this.knowledgeService.leaveKnowledge(+id, userId);
  }
}
