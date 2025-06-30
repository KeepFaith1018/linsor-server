import { Injectable, Logger } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import * as fs from 'fs';
import * as path from 'path';
import * as Tesseract from 'tesseract.js';
import { randomUUID } from 'crypto';
import {
  FileProcessResult,
  SimilaritySearchResult,
  QdrantPoint,
} from './types';
import { AppException } from 'src/common/exception/appException';
import { ErrorCode } from 'src/common/utils/errorCodes';

@Injectable()
export class VectorService {
  private readonly logger = new Logger(VectorService.name);
  private qdrantClient: QdrantClient;
  private embeddings: OpenAIEmbeddings;
  private textSplitter: RecursiveCharacterTextSplitter;
  private markdownSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    // 初始化Qdrant客户端
    this.qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });

    // 初始化OpenAI Embeddings
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.DASHSCOPE_API_KEY,
      configuration: {
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      },
      model: 'text-embedding-v4',
    });

    // 初始化不同类型的文本分割器
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // Markdown专用分割器
    this.markdownSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n## ', '\n### ', '\n#### ', '\n\n', '\n', ' ', ''],
    });
  }

  // 确保集合存在
  async ensureCollection(collectionName: string): Promise<void> {
    try {
      await this.qdrantClient.getCollection(collectionName);
    } catch (error) {
      await this.qdrantClient.createCollection(collectionName, {
        vectors: {
          size: 1024,
          distance: 'Cosine',
        },
      });
      this.logger.log(`因为没有${collectionName}，所以创建了一个新的集合`);
    }
  }

  // 添加文档到向量数据库
  async addDocument(
    knowledgeId: number,
    fileId: number,
    filePath: string,
    metadata: Record<string, any> = {},
  ) {
    const collectionName = `knowledge_${knowledgeId}`;
    await this.ensureCollection(collectionName);

    // 根据文件类型获取内容和分割文档
    const { content, chunks } = await this.processFileByType(
      filePath.replace('static', 'uploads'),
      metadata,
    );

    if (!content || chunks.length === 0) {
      throw new AppException(ErrorCode.VECTOR_FILE_FAILED);
    }

    // 分批处理chunks，避免超出API限制
    const batchSize = 10;
    const points: QdrantPoint[] = [];

    for (
      let batchStart = 0;
      batchStart < chunks.length;
      batchStart += batchSize
    ) {
      const batchEnd = Math.min(batchStart + batchSize, chunks.length);
      const batchChunks = chunks.slice(batchStart, batchEnd);

      this.logger.log(
        `正在处理第${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}批次 (${batchChunks.length} chunks)`,
      );

      // 批量生成向量
      const batchVectors = await this.embeddings.embedDocuments(batchChunks);

      this.logger.log(
        `第${Math.floor(batchStart / batchSize) + 1}批次向量加载成功`,
      );
      // 为当前批次的每个chunk创建point
      for (let i = 0; i < batchChunks.length; i++) {
        const globalIndex = batchStart + i;
        const chunk = batchChunks[i];
        const vector = batchVectors[i];

        points.push({
          id: randomUUID(),
          vector,
          payload: {
            fileId,
            knowledgeId,
            content: chunk,
            chunkIndex: globalIndex,
            originalContent: content.substring(0, 500),
            ...metadata,
          },
        });
      }

      // 添加延迟以避免API限制
      if (batchEnd < chunks.length) {
        await this.delay(50); // 每批次延迟1秒
      }
    }
    await this.qdrantClient.upsert(collectionName, {
      wait: true,
      points,
    });

    this.logger.log(`已为文件 ${fileId} 添加了 ${chunks.length} 个文本块`);

    return { chunksCount: chunks.length, contentLength: content.length };
  }

  // 添加延迟工具方法
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 根据文件类型处理文件
  private async processFileByType(
    filePath: string,
    metadata: Record<string, any>,
  ): Promise<FileProcessResult> {
    const fileExtension = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    this.logger.log(`正在处理文件: ${fileName}, 类型: ${fileExtension}`);

    let content = '';
    let chunks: string[] = [];

    switch (fileExtension) {
      case '.txt':
        content = await this.processTxtFile(filePath);
        chunks = await this.textSplitter.splitText(content);
        break;

      case '.md':
        content = this.processMarkdownFile(filePath);
        chunks = await this.markdownSplitter.splitText(content);
        break;

      case '.docx':
      case '.doc':
        content = await this.processWordFile(filePath);
        chunks = await this.textSplitter.splitText(content);
        break;

      case '.pdf':
        content = await this.processPdfFile(filePath);
        chunks = await this.textSplitter.splitText(content);
        break;

      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.bmp':
      case '.tiff':
        content = await this.processImageFile(filePath);
        chunks = await this.textSplitter.splitText(content);
        break;
      default:
        throw new AppException(ErrorCode.VECTOR_FILE_UNSUPPORTED);
    }

    return { content, chunks };
  }

  // 处理TXT文件
  private async processTxtFile(filePath: string): Promise<string> {
    try {
      const loader = new TextLoader(filePath);
      const docs = await loader.load();
      return docs.map((doc) => doc.pageContent).join('\n');
    } catch (error) {
      // 如果TextLoader失败，尝试直接读取文件
      return fs.readFileSync(filePath, 'utf-8');
    }
  }

  // 处理Markdown文件
  private processMarkdownFile(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // 可以在这里添加Markdown特殊处理逻辑

      this.logger.warn('处理mark' + content);
      return content;
    } catch (error) {
      throw new Error(`读取Markdown文件失败: ${(error as Error).message}`);
    }
  }

  // 处理Word文件
  private async processWordFile(filePath: string): Promise<string> {
    const loader = new DocxLoader(filePath);
    const docs = await loader.load();
    return docs.map((doc) => doc.pageContent).join('\n');
  }

  // 处理PDF文件
  private async processPdfFile(filePath: string): Promise<string> {
    const loader = new PDFLoader(filePath, {
      splitPages: false, // 不分页，获取完整内容
    });
    const docs = await loader.load();
    return docs.map((doc) => doc.pageContent).join('\n');
  }

  // 处理图片文件（OCR）
  private async processImageFile(filePath: string): Promise<string> {
    this.logger.log(`Starting OCR for image: ${path.basename(filePath)}`);

    const {
      data: { text },
    } = await Tesseract.recognize(filePath, 'chi_sim+eng', {
      logger: (m: Tesseract.LoggerMessage) => {
        if (m.status === 'recognizing text') {
          this.logger.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    if (!text || text.trim().length === 0) {
      throw new AppException(ErrorCode.VECTOR_FILE_IMG_EMPTY);
    }

    this.logger.log(`OCR completed, extracted ${text.length} characters`);
    return text;
  }

  // 获取文件类型信息
  getFileTypeInfo(filePath: string) {
    //   : FileTypeInfo
    const fileExtension = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);

    const typeMap: Record<string, { type: string; description: string }> = {
      '.txt': { type: 'text', description: '纯文本文件' },
      '.md': { type: 'markdown', description: 'Markdown文档' },
      '.docx': { type: 'word', description: 'Word文档' },
      '.doc': { type: 'word', description: 'Word文档' },
      '.pdf': { type: 'pdf', description: 'PDF文档' },
      '.jpg': { type: 'image', description: '图片文件' },
      '.jpeg': { type: 'image', description: '图片文件' },
      '.png': { type: 'image', description: '图片文件' },
      '.bmp': { type: 'image', description: '图片文件' },
      '.tiff': { type: 'image', description: '图片文件' },
    };

    return {
      fileName,
      extension: fileExtension,
      ...(typeMap[fileExtension] || {
        type: 'unknown',
        description: '未知文件类型',
      }),
    };
  }

  // 从向量数据库删除文档
  async removeDocument(knowledgeId: number, fileId: number): Promise<void> {
    const collectionName = `knowledge_${knowledgeId}`;

    await this.qdrantClient.delete(collectionName, {
      filter: {
        must: [{ key: 'fileId', match: { value: fileId } }],
      },
    });

    this.logger.log(`Removed document ${fileId} from knowledge ${knowledgeId}`);
  }

  // 相似性搜索
  async similaritySearch(
    knowledgeId: number,
    query: string,
    limit: number = 5,
  ): Promise<SimilaritySearchResult[]> {
    const collectionName = `knowledge_${knowledgeId}`;
    const collections = await this.qdrantClient.getCollections();
    const collectionExists = collections.collections.some(
      (collection) => collection.name === collectionName,
    );

    if (!collectionExists) {
      this.logger.warn(
        `Collection ${collectionName} does not exist, returning empty results`,
      );
      return [];
    }

    const queryVector = await this.embeddings.embedQuery(query);
    const searchResult = await this.qdrantClient.search(collectionName, {
      vector: queryVector,
      limit,
      with_payload: true,
    });

    return searchResult.map((point) => ({
      content: point.payload?.content as string,
      score: point.score || 0,
      metadata: point.payload as Record<string, any>,
    }));
  }

  // 删除知识库集合
  async deleteCollection(knowledgeId: number): Promise<void> {
    const collectionName = `knowledge_${knowledgeId}`;
    await this.qdrantClient.deleteCollection(collectionName);
    this.logger.log(`Deleted collection: ${collectionName}`);
  }
}
