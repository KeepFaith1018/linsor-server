import { Inject, Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { VectorService } from './vector.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { MessageEntiry } from '../conversation/entiry';
type Message = HumanMessage | AIMessage | SystemMessage;

@Injectable()
export class AiService {
  @Inject(WINSTON_MODULE_NEST_PROVIDER)
  private readonly logger;
  private globalChatModel: ChatOpenAI;
  private ragChatModel: ChatOpenAI;
  private outputParser: StringOutputParser;

  constructor(
    private readonly vectorService: VectorService,
    private readonly prisma: PrismaService,
  ) {
    // 初始化全网对话模型
    this.globalChatModel = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: {
        baseURL: 'https://api.siliconflow.cn/v1',
      },
      modelName: 'deepseek-ai/DeepSeek-R1',
    });

    // 初始化RAG对话模型
    this.ragChatModel = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: {
        baseURL: 'https://api.siliconflow.cn/v1',
      },
      modelName: 'deepseek-ai/DeepSeek-R1',
    });

    this.outputParser = new StringOutputParser();
  }

  // 全网AI对话
  async generateGlobalResponse(
    userMessage: string,
    messageHistory: any[] = [],
  ): Promise<string> {
    try {
      // 构建对话历史
      const messages = this.buildMessageHistory(messageHistory);
      messages.push(new HumanMessage(userMessage));

      // 调用模型生成回复
      const response = await this.globalChatModel.invoke(messages);
      return await this.outputParser.invoke(response);
    } catch (error) {
      this.logger.error(`Error in global AI response: ${error.message}`);
      throw error;
    }
  }

  // 基于知识库的RAG对话
  async generateKnowledgeResponse(
    userMessage: string,
    knowledgeId: number,
    messageHistory: MessageEntiry[] = [],
  ): Promise<string> {
    try {
      // 1. 从向量数据库检索相关文档
      const relevantDocs = await this.vectorService.similaritySearch(
        knowledgeId,
        userMessage,
        5,
      );

      // 2. 构建RAG提示词
      const context = relevantDocs.map((doc) => doc.content).join('\n\n');

      const ragPrompt = ChatPromptTemplate.fromTemplate(`
你是一个智能助手，请基于以下提供的知识库内容来回答用户的问题。
如果知识库中没有相关信息，请明确告知用户。

知识库内容：
{context}

用户问题：{question}

请基于上述知识库内容回答用户问题：`);

      // 3. 构建消息历史
      const messages = this.buildMessageHistory(messageHistory);

      // 4. 添加RAG提示词和用户问题
      const formattedPrompt = await ragPrompt.format({
        context,
        question: userMessage,
      });

      messages.push(new HumanMessage(formattedPrompt));

      // 5. 调用模型生成回复
      const response = await this.ragChatModel.invoke(messages);
      return await this.outputParser.invoke(response);
    } catch (error) {
      this.logger.error(`Error in knowledge AI response: ${error.message}`);
      throw error;
    }
  }

  // 构建消息历史
  private buildMessageHistory(messageHistory: MessageEntiry[]) {
    const messages = [] as Message[];

    // 添加系统消息
    messages.push(
      new SystemMessage('你是一个有用的AI助手，请友好、准确地回答用户的问题。'),
    );

    // 添加历史消息（最近10条）
    const recentHistory = messageHistory.slice(-10);
    for (const msg of recentHistory) {
      if (msg.sender_type === 'user') {
        messages.push(new HumanMessage(msg.content));
      } else if (msg.sender_type === 'ai') {
        messages.push(new AIMessage(msg.content));
      }
    }

    return messages;
  }

  // 处理文件上传到向量数据库
  async processFileForVector(
    knowledgeId: number,
    fileId: number,
    filePath: string, // 改为文件路径
    metadata: any = {},
  ) {
    return await this.vectorService.addDocument(
      knowledgeId,
      fileId,
      filePath,
      metadata,
    );
  }

  // 添加获取文件类型信息的方法
  getFileTypeInfo(filePath: string) {
    return this.vectorService.getFileTypeInfo(filePath);
  }

  // 从向量数据库删除文件
  async removeFileFromVector(knowledgeId: number, fileId: number) {
    return await this.vectorService.removeDocument(knowledgeId, fileId);
  }

  // 删除知识库向量数据
  async deleteKnowledgeVectors(knowledgeId: number) {
    return await this.vectorService.deleteCollection(knowledgeId);
  }
}
