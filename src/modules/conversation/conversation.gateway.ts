import { Injectable, OnModuleInit } from '@nestjs/common';
import * as WebSocket from 'ws';
import { ConversationService } from './conversation.service';

@Injectable()
export class ConversationGateway implements OnModuleInit {
  private wss: WebSocket.Server;
  private clients = new Map<string, WebSocket>();

  constructor(private readonly conversationService: ConversationService) {}

  onModuleInit() {
    this.wss = new WebSocket.Server({ port: 3001 });
    console.log('原生WebSocket服务器启动在端口 3001');

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);
      (ws as any).clientId = clientId;

      console.log(`WebSocket客户端连接: ${clientId}`);

      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('解析消息失败:', error);
          this.sendError(ws, '消息格式错误');
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`WebSocket客户端断开: ${clientId}`);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket错误: ${error}`);
        this.clients.delete(clientId);
      });
    });
  }

  private async handleMessage(ws: WebSocket, message: any) {
    const { type, data } = message;

    switch (type) {
      case 'startAiResponse':
        await this.handleStartAiResponse(ws, data);
        break;
      case 'stopAiResponse':
        this.handleStopAiResponse(ws, data);
        break;
      default:
        this.sendError(ws, `未知消息类型: ${type}`);
    }
  }

  private async handleStartAiResponse(
    ws: WebSocket,
    data: {
      conversation_id: number;
      user_message: string;
      userId: number;
    },
  ) {
    try {
      console.log(
        `[${new Date().toISOString()}] 🚀 开始WebSocket流式AI响应，会话ID: ${data.conversation_id}`,
      );

      // 发送开始信号
      this.sendMessage(ws, {
        type: 'aiResponse',
        data: {
          type: 'start',
          content: '',
          timestamp: new Date().toISOString(),
        },
      });

      // 获取流式响应生成器
      const generator = this.conversationService.generateStreamAiResponse(
        data.conversation_id,
        data.user_message,
        data.userId,
      );

      // 逐步发送AI响应
      for await (const chunk of generator) {
        if (ws.readyState === WebSocket.OPEN) {
          this.sendMessage(ws, {
            type: 'aiResponse',
            data: {
              type: 'token',
              content: chunk,
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          break; // 连接已关闭，停止发送
        }
      }

      // 发送完成信号
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, {
          type: 'aiResponse',
          data: {
            type: 'done',
            content: '',
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.log(
        `[${new Date().toISOString()}] ✅ WebSocket流式AI响应完成，会话ID: ${data.conversation_id}`,
      );
    } catch (error) {
      console.error(`WebSocket流式响应错误: ${error.message}`);
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, {
          type: 'aiResponse',
          data: {
            type: 'error',
            content: error.message,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  }

  private handleStopAiResponse(
    ws: WebSocket,
    data: { conversation_id: number },
  ) {
    console.log(`用户停止AI响应，会话ID: ${data.conversation_id}`);
    this.sendMessage(ws, {
      type: 'aiResponse',
      data: {
        type: 'stopped',
        content: '',
        timestamp: new Date().toISOString(),
      },
    });
  }

  private sendMessage(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.sendMessage(ws, {
      type: 'error',
      data: {
        message: error,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private generateClientId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
