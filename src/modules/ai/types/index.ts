export interface FileProcessResult {
  content: string;
  chunks: string[];
}

export interface SimilaritySearchResult {
  content: string;
  score: number;
  metadata: Record<string, any>;
}

export interface QdrantPoint {
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
