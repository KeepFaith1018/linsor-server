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
import { Document } from 'langchain/document';
// 类型定义
interface FileProcessResult {
  content: string;
  chunks: string[];
}

interface AddDocumentResult {
  chunksCount: number;
  contentLength: number;
}

interface SimilaritySearchResult {
  content: string;
  score: number;
  metadata: Record<string, any>;
}

interface FileTypeInfo {
  fileName: string;
  extension: string;
  type: string;
  description: string;
}

interface QdrantPoint {
  id: string;
  vector: number[];
  payload: {
    fileId: number;
    knowledgeId: number;
    content: string;
    chunkIndex: number;
    originalContent: string;
    [key: string]: any;
  };
}

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
      this.logger.log(`Created collection: ${collectionName}`);
    }
  }

  // 添加文档到向量数据库
  async addDocument(
    knowledgeId: number,
    fileId: number,
    filePath: string,
    metadata: Record<string, any> = {},
  ) {
    //   : Promise<AddDocumentResult>
    try {
      const collectionName = `knowledge_${knowledgeId}`;
      await this.ensureCollection(collectionName);

      // 根据文件类型获取内容和分割文档
      const { content, chunks } = await this.processFileByType(
        filePath,
        metadata,
      );

      if (!content || chunks.length === 0) {
        throw new Error('无法从文件中提取内容');
      }

      // 分批处理chunks，避免超出API限制
      const batchSize = 15; // 每批最多15个
      const points: QdrantPoint[] = [];

      for (
        let batchStart = 0;
        batchStart < chunks.length;
        batchStart += batchSize
      ) {
        const batchEnd = Math.min(batchStart + batchSize, chunks.length);
        const batchChunks = chunks.slice(batchStart, batchEnd);

        this.logger.log(
          `Processing batch ${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (${batchChunks.length} chunks)`,
        );

        // 批量生成向量
        const batchVectors = await this.embeddings.embedDocuments(batchChunks);

        // 为当前批次的每个chunk创建point
        for (let i = 0; i < batchChunks.length; i++) {
          const globalIndex = batchStart + i;
          const chunk = batchChunks[i];
          const vector = batchVectors[i];

          points.push({
            id: `${fileId}_${globalIndex}`,
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
          await this.delay(1000); // 延迟1秒
        }
      }

      await this.qdrantClient.upsert(collectionName, {
        wait: true,
        points,
      });

      this.logger.log(`Added ${chunks.length} chunks for file ${fileId}`);
      return { chunksCount: chunks.length, contentLength: content.length };
    } catch (error) {
      this.logger.error(`Error adding document: ${(error as Error).message}`);
      throw error;
    }
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

    try {
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
          throw new Error(`不支持的文件类型: ${fileExtension}`);
      }

      return { content, chunks };
    } catch (error) {
      this.logger.error(
        `不能处理的文件 ${fileName}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // 处理TXT文件
  private async processTxtFile(filePath: string): Promise<string> {
    try {
      const loader = new TextLoader(filePath);
      const docs = await loader.load();
      return (docs as Document<Record<string, any>>[])
        .map((doc) => doc.pageContent)
        .join('\n');
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
      return content;
    } catch (error) {
      throw new Error(`读取Markdown文件失败: ${(error as Error).message}`);
    }
  }

  // 处理Word文件
  private async processWordFile(filePath: string): Promise<string> {
    try {
      const loader = new DocxLoader(filePath);
      const docs = await loader.load();
      return docs.map((doc) => doc.pageContent).join('\n');
    } catch (error) {
      throw new Error(`处理Word文件失败: ${(error as Error).message}`);
    }
  }

  // 处理PDF文件
  private async processPdfFile(filePath: string): Promise<string> {
    try {
      const loader = new PDFLoader(filePath, {
        splitPages: false, // 不分页，获取完整内容
      });
      const docs = await loader.load();
      return docs.map((doc) => doc.pageContent).join('\n');
    } catch (error) {
      throw new Error(`处理PDF文件失败: ${(error as Error).message}`);
    }
  }

  // 处理图片文件（OCR）
  private async processImageFile(filePath: string): Promise<string> {
    try {
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
        throw new Error('OCR未能从图片中提取到文本内容');
      }

      this.logger.log(`OCR completed, extracted ${text.length} characters`);
      // TODO: as 类型报错。
      return text as string;
    } catch (error) {
      throw new Error(`图片OCR处理失败: ${(error as Error).message}`);
    }
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
    try {
      const collectionName = `knowledge_${knowledgeId}`;

      await this.qdrantClient.delete(collectionName, {
        filter: {
          must: [{ key: 'fileId', match: { value: fileId } }],
        },
      });

      this.logger.log(
        `Removed document ${fileId} from knowledge ${knowledgeId}`,
      );
    } catch (error) {
      this.logger.error(`Error removing document: ${(error as Error).message}`);
      throw error;
    }
  }

  // 相似性搜索
  async similaritySearch(
    knowledgeId: number,
    query: string,
    limit: number = 5,
  ): Promise<SimilaritySearchResult[]> {
    try {
      const collectionName = `knowledge_${knowledgeId}`;
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
    } catch (error) {
      this.logger.error(
        `Error in similarity search: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // 删除知识库集合
  async deleteCollection(knowledgeId: number): Promise<void> {
    try {
      const collectionName = `knowledge_${knowledgeId}`;
      await this.qdrantClient.deleteCollection(collectionName);
      this.logger.log(`Deleted collection: ${collectionName}`);
    } catch (error) {
      this.logger.error(
        `Error deleting collection: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
