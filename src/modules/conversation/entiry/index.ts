// 定义消息的类型
export type MessageEntiry = {
  id: number;
  conversation_id: number;
  sender_type: string;
  isSuccess: boolean;
  content: string;
  created_at: Date;
};
