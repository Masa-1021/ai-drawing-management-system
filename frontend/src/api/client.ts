/**
 * API Client
 */

import axios from 'axios';

// 現在のホストに基づいてAPI URLを動的に生成
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = window.location.hostname;
    return `${protocol}//${host}:8000`;
  }
  return 'http://localhost:8000';
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || getApiUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5分に延長（AI解析に時間がかかるため）
  headers: {
    'Content-Type': 'application/json',
  },
});

// リクエストインターセプター
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// AWS認証エラーかどうかを判定
export const isAWSAuthError = (error: unknown): boolean => {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    const detail = error.response.data?.detail;
    return detail?.error_code === 'AWS_AUTH_EXPIRED';
  }
  return false;
};

// AWS認証エラーのメッセージを取得
export const getAWSAuthErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    const detail = error.response.data?.detail;
    if (detail?.message) {
      return detail.message;
    }
  }
  return 'AWS認証エラーが発生しました。';
};

// AWS認証エラーイベント名
export const AWS_AUTH_ERROR_EVENT = 'aws-auth-error';

// AWS認証エラーイベントを発火
export const dispatchAWSAuthError = (message: string) => {
  window.dispatchEvent(new CustomEvent(AWS_AUTH_ERROR_EVENT, { detail: { message } }));
};

// AI接続状態のレスポンス型
export interface AIStatusResponse {
  status: 'ok' | 'error';
  message: string;
  error_type: 'aws_auth' | 'connection' | 'unknown' | null;
  command: string | null;
  sso_url?: string | null;
  detail?: string;
}

// AWS SSO認証開始のレスポンス型
export interface SSOAuthStartResponse {
  status: 'ok' | 'error';
  verification_uri?: string;
  user_code?: string;
  device_code?: string;
  client_id?: string;
  client_secret?: string;
  expires_in?: number;
  message?: string;
}

// AWS SSO認証完了のレスポンス型
export interface SSOAuthCompleteResponse {
  status: 'ok' | 'error' | 'pending';
  message?: string;
  expires_at?: string;
}

// AI接続状態をチェック
export const checkAIStatus = async (): Promise<AIStatusResponse> => {
  try {
    const response = await apiClient.get<AIStatusResponse>('/v1/ai-status');
    return response.data;
  } catch (error) {
    // Axiosエラーの場合
    if (axios.isAxiosError(error)) {
      // サーバーからレスポンスがあった場合（4xx, 5xx）
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        // サーバーがAIStatusResponse形式でエラーを返した場合
        if (data && typeof data === 'object' && 'status' in data) {
          return data as AIStatusResponse;
        }

        // 500エラーの場合
        if (status >= 500) {
          return {
            status: 'error',
            message: 'バックエンドサーバーでエラーが発生しました',
            error_type: 'connection',
            command: null,
            detail: data?.detail || `サーバーエラー (${status})`,
          };
        }

        // その他のエラー
        return {
          status: 'error',
          message: 'AI接続状態の確認に失敗しました',
          error_type: 'unknown',
          command: null,
          detail: data?.detail || error.message,
        };
      }

      // ネットワークエラー（サーバーに到達できない）
      if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
        return {
          status: 'error',
          message: 'バックエンドサーバーに接続できません',
          error_type: 'connection',
          command: null,
          detail: 'サーバーが起動しているか確認してください。Docker環境: docker compose -f docker-compose.dev.yml up -d',
        };
      }

      // タイムアウト
      if (error.code === 'ECONNABORTED') {
        return {
          status: 'error',
          message: '接続がタイムアウトしました',
          error_type: 'connection',
          command: null,
          detail: 'サーバーの応答が遅れています。しばらく待ってから再試行してください。',
        };
      }
    }

    // その他の予期せぬエラー
    return {
      status: 'error',
      message: 'AI接続状態の確認に失敗しました',
      error_type: 'unknown',
      command: null,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
};

// AWS SSO認証を開始（ブラウザで認証ページを開く）
export const startSSOAuth = async (): Promise<SSOAuthStartResponse> => {
  try {
    const response = await apiClient.post<SSOAuthStartResponse>('/v1/aws-sso/start-auth');
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return {
        status: 'error',
        message: error.response.data?.message || 'SSO認証の開始に失敗しました',
      };
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'SSO認証の開始に失敗しました',
    };
  }
};

// AWS SSO認証を完了（トークン取得・保存）
export const completeSSOAuth = async (
  deviceCode: string,
  clientId: string,
  clientSecret: string
): Promise<SSOAuthCompleteResponse> => {
  try {
    const params = new URLSearchParams();
    params.append('device_code', deviceCode);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const response = await apiClient.post<SSOAuthCompleteResponse>(
      '/v1/aws-sso/complete-auth',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return {
        status: 'error',
        message: error.response.data?.message || 'SSO認証の完了に失敗しました',
      };
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'SSO認証の完了に失敗しました',
    };
  }
};

// レスポンスインターセプター
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] Response:`, response.status, response.data);
    return response;
  },
  (error) => {
    // AWS認証エラーの場合はイベントを発火
    if (isAWSAuthError(error)) {
      const message = getAWSAuthErrorMessage(error);
      console.error('[API] AWS Authentication Error:', message);
      dispatchAWSAuthError(message);
    }
    // 404エラーは通常の動作（サンプルデータへのフォールバック）として扱うのでwarning
    else if (error.response?.status === 404) {
      console.warn('[API] Response error:', error.response?.data || error.message);
    }
    // AI接続チェック（/ai-status）の500エラーは期待される動作なのでwarning
    else if (error.response?.status === 500 && error.config?.url?.includes('/ai-status')) {
      console.warn('[API] AI status check returned error (expected when AWS credentials are not configured)');
    } else {
      console.error('[API] Response error:', error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
