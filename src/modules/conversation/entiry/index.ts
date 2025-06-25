// 定义消息的类型
export type MessageEntiry = {
  id: number;
  created_at: Date | null;
  conversation_id: number;
  sender_type: string;
  isSuccess: boolean | null;
  content: string;
};
