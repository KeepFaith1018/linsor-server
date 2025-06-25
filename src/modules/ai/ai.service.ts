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
    const startTime = Date.now();
    console.log(
      `[${new Date().toISOString()}] 🧠 generateKnowledgeResponse 开始执行`,
    );
    console.log(
      `[${new Date().toISOString()}] 📝 用户消息: ${userMessage.substring(0, 100)}...`,
    );
    console.log(`[${new Date().toISOString()}] 🏷️ 知识库ID: ${knowledgeId}`);

    try {
      // 1. 从向量数据库检索相关文档
      console.log(`[${new Date().toISOString()}] 🔍 开始向量相似度搜索`);
      const vectorSearchStart = Date.now();
      const relevantDocs = await this.vectorService.similaritySearch(
        knowledgeId,
        userMessage,
        5,
      );
      const vectorSearchTime = Date.now() - vectorSearchStart;
      console.log(
        `[${new Date().toISOString()}] ✅ 向量搜索完成，耗时: ${vectorSearchTime}ms，找到 ${relevantDocs.length} 个相关文档`,
      );

      // 2. 构建RAG提示词
      console.log(`[${new Date().toISOString()}] 📋 开始构建RAG上下文`);
      const contextBuildStart = Date.now();
      const context = relevantDocs.map((doc) => doc.content).join('\n\n');
      const contextLength = context.length;
      console.log(relevantDocs);
      const ragPrompt = ChatPromptTemplate.fromTemplate(`
你是一个智能助手，请基于以下提供的知识库内容来回答用户的问题。在回答问题时指出参考了知识库中哪些内容
如果知识库中没有相关信息，请明确告知用户。

知识库内容：
{context}

用户问题：{question}

请基于上述知识库内容回答用户问题：`);
      const contextBuildTime = Date.now() - contextBuildStart;
      console.log(
        `[${new Date().toISOString()}] ✅ RAG上下文构建完成，耗时: ${contextBuildTime}ms，上下文长度: ${contextLength} 字符`,
      );

      // 3. 构建消息历史
      console.log(`[${new Date().toISOString()}] 📚 开始构建消息历史`);
      const messageHistoryStart = Date.now();
      const messages = this.buildMessageHistory(messageHistory);
      const messageHistoryTime = Date.now() - messageHistoryStart;
      console.log(
        `[${new Date().toISOString()}] ✅ 消息历史构建完成，耗时: ${messageHistoryTime}ms，历史消息数: ${messageHistory.length}`,
      );

      // 4. 添加RAG提示词和用户问题
      console.log(`[${new Date().toISOString()}] 🔧 开始格式化提示词`);
      const promptFormatStart = Date.now();
      const formattedPrompt = await ragPrompt.format({
        context,
        question: userMessage,
      });
      const promptFormatTime = Date.now() - promptFormatStart;
      console.log(
        `[${new Date().toISOString()}] ✅ 提示词格式化完成，耗时: ${promptFormatTime}ms，最终提示词长度: ${formattedPrompt.length} 字符`,
      );

      messages.push(new HumanMessage(formattedPrompt));

      // 5. 调用模型生成回复
      console.log(`[${new Date().toISOString()}] 🤖 开始调用RAG模型`);
      const modelInvokeStart = Date.now();
      const response = await this.ragChatModel.invoke(messages);
      const modelInvokeTime = Date.now() - modelInvokeStart;
      console.log(
        `[${new Date().toISOString()}] ✅ RAG模型调用完成，耗时: ${modelInvokeTime}ms`,
      );

      console.log(`[${new Date().toISOString()}] 🔄 开始解析输出`);
      const parseStart = Date.now();
      const finalResponse = await this.outputParser.invoke(response);
      const parseTime = Date.now() - parseStart;
      const responseLength = finalResponse.length;
      console.log(
        `[${new Date().toISOString()}] ✅ 输出解析完成，耗时: ${parseTime}ms，响应长度: ${responseLength} 字符`,
      );

      const totalTime = Date.now() - startTime;
      console.log(
        `[${new Date().toISOString()}] 🎉 generateKnowledgeResponse 执行完成`,
      );
      console.log(`📊 AI服务性能统计:`);
      console.log(
        `  - 向量搜索: ${vectorSearchTime}ms (${((vectorSearchTime / totalTime) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  - 上下文构建: ${contextBuildTime}ms (${((contextBuildTime / totalTime) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  - 消息历史构建: ${messageHistoryTime}ms (${((messageHistoryTime / totalTime) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  - 提示词格式化: ${promptFormatTime}ms (${((promptFormatTime / totalTime) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  - 模型调用: ${modelInvokeTime}ms (${((modelInvokeTime / totalTime) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  - 输出解析: ${parseTime}ms (${((parseTime / totalTime) * 100).toFixed(1)}%)`,
      );
      console.log(`  - 总耗时: ${totalTime}ms`);
      console.log(`==========================================`);

      return finalResponse;
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error(
        `[${new Date().toISOString()}] ❌ generateKnowledgeResponse 执行失败，耗时: ${errorTime}ms`,
      );
      console.error(`❌ 错误详情: ${error.message}`);
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

  // 在 AiService 中新增流式响应方法

  // 全网搜索流式响应
  async *generateGlobalStreamResponse(
    userMessage: string,
    messageHistory: any[] = [],
  ): AsyncGenerator<string, void, unknown> {
    try {
      console.log(`[${new Date().toISOString()}] 🌐 开始全网搜索流式响应`);

      const messages = this.buildMessageHistory(messageHistory);
      messages.push(new HumanMessage(userMessage));

      // 使用流式调用
      const stream = await this.globalChatModel.stream(messages);

      for await (const chunk of stream) {
        if (chunk.content) {
          yield chunk.content as string;
        }
      }

      console.log(`[${new Date().toISOString()}] ✅ 全网搜索流式响应完成`);
    } catch (error) {
      console.error(`全网搜索流式响应错误: ${error.message}`);
      throw error;
    }
  }

  // 知识库RAG流式响应
  async *generateKnowledgeStreamResponse(
    userMessage: string,
    knowledgeId: number,
    messageHistory: any[] = [],
  ): AsyncGenerator<string, void, unknown> {
    try {
      console.log(`[${new Date().toISOString()}] 🧠 开始知识库RAG流式响应`);

      // 1. 向量搜索
      const vectorStart = Date.now();
      const relevantDocs = await this.vectorService.similaritySearch(
        knowledgeId,
        userMessage,
        5,
      );
      console.log(
        `[${new Date().toISOString()}] 📊 向量搜索完成，耗时: ${Date.now() - vectorStart}ms`,
      );

      // 2. 构建RAG上下文
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

      console.log(`[${new Date().toISOString()}] ✅ 知识库RAG流式响应完成`);
    } catch (error) {
      console.error(`知识库RAG流式响应错误: ${error.message}`);
      throw error;
    }
  }
}
