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

  constructor(private readonly vectorService: VectorService) {
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
      model: 'deepseek-ai/DeepSeek-R1',
    });

    this.outputParser = new StringOutputParser();
  }

  // 构建消息历史
  private buildMessageHistory(messageHistory: MessageEntiry[]) {
    const messages = [] as Message[];

    // 添加系统消息
    messages.push(
      new SystemMessage(
        '你是一个友好且乐于助人的AI助手，能够理解各种问题并给出准确、有条理且富有同理心的回答。请以专业且通俗易懂的语言，帮助用户解决问题，必要时提供详细解释和建议。',
      ),
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

  // 全网搜索流式响应
  async *generateGlobalStreamResponse(
    userMessage: string,
    messageHistory: any[] = [],
  ): AsyncGenerator<string, void, unknown> {
    const messages = this.buildMessageHistory(messageHistory);
    messages.push(new HumanMessage(userMessage));
    this.logger.log(`[${new Date().toISOString()}] 🌐 开始全网搜索流式响应`);
    // 使用流式调用
    const stream = await this.globalChatModel.stream(messages);

    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content as any;
      }
    }
  }

  // 知识库RAG流式响应
  async *generateKnowledgeStreamResponse(
    userMessage: string,
    knowledgeId: number,
    messageHistory: any[] = [],
  ): AsyncGenerator<string, void, unknown> {
    // 1. 向量搜索
    const vectorStart = Date.now();
    const relevantDocs = await this.vectorService.similaritySearch(
      knowledgeId,
      userMessage,
      5,
    );
    this.logger.log(
      `[${new Date().toISOString()}] 📊 向量搜索完成，耗时: ${Date.now() - vectorStart}ms，数量: ${relevantDocs.length}`,
    );

    // 2. 如果未命中任何向量
    if (!relevantDocs || relevantDocs.length === 0) {
      this.logger.warn(
        `[${new Date().toISOString()}] 🚨 未检索到任何相关文档，知识库ID: ${knowledgeId}`,
      );
      yield '抱歉，当前知识库中没有找到与您的问题相关的内容，请先上传文件或换个问题试试。';
      return;
    }

    // 2. 构建RAG上下文
    const context = relevantDocs.map((doc) => doc.content).join('\n\n');
    const ragPrompt = ChatPromptTemplate.fromTemplate(`
你是一个智能助手，请基于以下提供的知识库内容准确回答用户的问题。  
如果知识库中没有相关信息，请礼貌告知用户，并建议换个问题或提供更多细节。

知识库内容：  
{context}

用户问题：  
{question}

请结合上述知识库内容，详细且清晰地回答用户的问题：
`);

    // 3. 构建消息历史
    const messages = this.buildMessageHistory(messageHistory);
    const formattedPrompt = await ragPrompt.format({
      context,
      question: userMessage,
    });
    messages.push(new HumanMessage(formattedPrompt));

    // 4. 流式调用模型
    const stream = await this.ragChatModel.stream(messages);

    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content as any;
      }
    }

    this.logger.log(`[${new Date().toISOString()}] ✅ 知识库RAG流式响应完成`);
  }
}
