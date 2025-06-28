export interface JwtPayload {
  userId: number;
  openid: string;
}

// 定义微信API响应类型
export interface WechatApiResponse {
  openid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

// 定义微信用户信息类型
export interface WechatUserInfo {
  openid: string;
  session_key: string;
}
