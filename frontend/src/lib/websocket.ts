/**
 * WebSocket Client
 * 
 * Socket.IOを使用したWebSocketクライアント
 */

import { io, Socket } from 'socket.io-client';

// WebSocket URLを環境変数または現在のホストから生成
const getWebSocketUrl = () => {
  // 明示的にWebSocket URLが設定されている場合（絶対URL）
  if (import.meta.env.VITE_WS_BASE_URL && !import.meta.env.VITE_WS_BASE_URL.startsWith('/')) {
    return import.meta.env.VITE_WS_BASE_URL;
  }

  // ブラウザ環境では現在のホストから動的に生成
  // Docker環境でもブラウザからはlocalhost:8000でバックエンドにアクセス可能
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = window.location.hostname;
    // Docker環境ではポート8000がホストにマップされている
    return `${protocol}//${host}:8000`;
  }
  return 'http://localhost:8000';
};

const WS_BASE_URL = getWebSocketUrl();

interface DrawingEventData {
  type: 'locked' | 'unlocked';
  drawing_id: string;
  locked_by?: string;
}

interface UploadProgressData {
  message: string;
  level: 'info' | 'success' | 'error' | 'warning';
}

type DrawingEventHandler = (data: DrawingEventData) => void;
type UploadProgressHandler = (data: UploadProgressData) => void;

class WebSocketClient {
  private socket: Socket | null = null;
  private subscriptions: Map<string, DrawingEventHandler[]> = new Map();
  private uploadProgressHandlers: UploadProgressHandler[] = [];

  /**
   * WebSocketに接続
   */
  connect(): void {
    // 既にソケットが存在する場合（接続中または接続済み）は再利用
    if (this.socket) {
      if (this.socket.connected) {
        console.log('[WebSocket] Already connected');
      } else {
        console.log('[WebSocket] Socket exists, waiting for connection...');
      }
      return;
    }

    console.log('[WebSocket] Connecting to:', WS_BASE_URL);

    this.socket = io(WS_BASE_URL, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],  // websocketを優先（リアルタイム性向上）
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 60000,  // 接続タイムアウトを60秒に延長
      upgrade: true,  // pollingからwebsocketへのアップグレードを許可
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected successfully to:', WS_BASE_URL);
    });

    this.socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
    });

    this.socket.on('drawing_locked', (data: { drawing_id: string; locked_by: string }) => {
      const handlers = this.subscriptions.get(data.drawing_id);
      if (handlers) {
        handlers.forEach((handler) => {
          handler({
            type: 'locked',
            drawing_id: data.drawing_id,
            locked_by: data.locked_by,
          });
        });
      }
    });

    this.socket.on('drawing_unlocked', (data: { drawing_id: string }) => {
      const handlers = this.subscriptions.get(data.drawing_id);
      if (handlers) {
        handlers.forEach((handler) => {
          handler({
            type: 'unlocked',
            drawing_id: data.drawing_id,
          });
        });
      }
    });

    this.socket.on('upload_progress', (data: UploadProgressData) => {
      console.log('[WebSocket] upload_progress received:', data);
      console.log('[WebSocket] handlers to call:', this.uploadProgressHandlers.length);
      this.uploadProgressHandlers.forEach((handler) => {
        console.log('[WebSocket] calling handler');
        handler(data);
      });
    });

    // デバッグ: 全イベントをログ
    this.socket.onAny((eventName: string, ...args: unknown[]) => {
      console.log('[WebSocket] Event received:', eventName, args);
    });

    this.socket.on('error', (error: unknown) => {
      // 接続エラーは再接続が試みられるため、warningレベルで出力
      console.warn('[WebSocket] Connection error (will retry):', error);
    });

    this.socket.on('connect_error', (error: Error) => {
      // 接続エラー（バックエンドが起動していない等）
      console.warn('[WebSocket] Connect error (will retry):', error.message);
    });
  }

  /**
   * WebSocketから切断
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.subscriptions.clear();
    }
  }

  /**
   * 図面の変更を購読
   */
  subscribeDrawing(drawingId: string, handler: DrawingEventHandler): void {
    if (!this.socket?.connected) {
      this.connect();
    }

    // ハンドラーを登録
    if (!this.subscriptions.has(drawingId)) {
      this.subscriptions.set(drawingId, []);
    }
    this.subscriptions.get(drawingId)!.push(handler);

    // サーバーに購読を通知
    if (this.socket) {
      this.socket.emit('subscribe_drawing', { drawing_id: drawingId });
    }
  }

  /**
   * 図面の購読を解除
   */
  unsubscribeDrawing(drawingId: string): void {
    // ハンドラーを削除
    this.subscriptions.delete(drawingId);

    // サーバーに購読解除を通知
    if (this.socket) {
      this.socket.emit('unsubscribe_drawing', { drawing_id: drawingId });
    }
  }

  /**
   * アップロード進捗を購読
   */
  subscribeUploadProgress(handler: UploadProgressHandler): void {
    console.log('[WebSocket] subscribeUploadProgress called, connected:', this.socket?.connected);
    if (!this.socket?.connected) {
      this.connect();
    }
    this.uploadProgressHandlers.push(handler);
    console.log('[WebSocket] uploadProgressHandlers count:', this.uploadProgressHandlers.length);
  }

  /**
   * アップロード進捗の購読を解除
   */
  unsubscribeUploadProgress(handler: UploadProgressHandler): void {
    const index = this.uploadProgressHandlers.indexOf(handler);
    if (index > -1) {
      this.uploadProgressHandlers.splice(index, 1);
    }
  }

  /**
   * 接続状態を確認
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// シングルトンインスタンス
export const websocketClient = new WebSocketClient();

// アプリケーション起動時に接続を初期化
websocketClient.connect();

