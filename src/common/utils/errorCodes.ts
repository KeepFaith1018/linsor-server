// 业务错误枚举
// 可以处理的错误处理
export enum ErrorCode {
  // 知识库模块
  KNOWLEDGE_NOT_FOUND = 1001,
  KNOWLEDGE_UNAUTHORIZED = 1002,
  KNOWLEDGE_NOT_SHARED = 1003,
  KNOWLEDGE_HAS_JOINED = 1004,
  KNOWLEDGE_HAS_OWNED = 1005,
  KNOWLEDGE_NOT_JOINED = 1006,

  // 文件模块
  FILE_NOT_FOUND = 2001,

  // 会话模块
  CONVERSATION_NOT_FOUND = 3001,
  CONVERSATION_UNAUTHORIZED = 3002,
  MESSAGE_NOT_FOUND = 3003,
  MESSAGE_UNAUTHORIZED = 3004,

  // 向量模块
  VECTOR_FILE_FAILED = 4001,
  VECTOR_FILE_UNSUPPORTED = 4002,
  VECTOR_FILE_IMG_EMPTY = 4003,
}

export const ErrorMessageMap: Record<ErrorCode, string> = {
  [ErrorCode.KNOWLEDGE_NOT_FOUND]: '知识库未找到',
  [ErrorCode.KNOWLEDGE_UNAUTHORIZED]: '知识库权限不足',
  [ErrorCode.KNOWLEDGE_NOT_SHARED]: '知识库未共享',
  [ErrorCode.KNOWLEDGE_HAS_JOINED]: '知识库已加入',
  [ErrorCode.KNOWLEDGE_HAS_OWNED]: '知识库已拥有',
  [ErrorCode.KNOWLEDGE_NOT_JOINED]: '知识库未加入',

  [ErrorCode.FILE_NOT_FOUND]: '文件未找到',

  [ErrorCode.CONVERSATION_NOT_FOUND]: '会话不存在',
  [ErrorCode.CONVERSATION_UNAUTHORIZED]: '会话没有权限',

  [ErrorCode.MESSAGE_NOT_FOUND]: '消息不存在',
  [ErrorCode.MESSAGE_UNAUTHORIZED]: '消息没有权限',

  [ErrorCode.VECTOR_FILE_FAILED]: '无法处理该文件',
  [ErrorCode.VECTOR_FILE_UNSUPPORTED]: '不支持的文件类型',
  [ErrorCode.VECTOR_FILE_IMG_EMPTY]: '图片取到文本内容',
};
