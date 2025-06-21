// 业务错误枚举

export enum ErrorCode {
  UNKNOWN_ERROR = 10000,

  UNAUTHORIZED = 10001,
  FORBIDDEN = 10002,

  USER_NOT_FOUND = 20001,
  INVALID_CREDENTIALS = 20002,

  KNOWLEDGE_NOT_FOUND = 30001,
}

export const ErrorMessageMap: Record<ErrorCode, string> = {
  [ErrorCode.UNKNOWN_ERROR]: '未知错误',
  [ErrorCode.UNAUTHORIZED]: '未授权或登录失效',
  [ErrorCode.FORBIDDEN]: '无权限访问',
  [ErrorCode.USER_NOT_FOUND]: '用户不存在',
  [ErrorCode.INVALID_CREDENTIALS]: '用户名或密码错误',
  [ErrorCode.KNOWLEDGE_NOT_FOUND]: '知识库未找到',
};
