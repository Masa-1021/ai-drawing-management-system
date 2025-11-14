/**
 * Lock API Client
 */

import apiClient from './client';

export interface Lock {
  drawing_id: number;
  user_id: string;
  acquired_at: string;
}

export const lockApi = {
  /**
   * ロックを取得
   */
  acquireLock: async (drawingId: number, userId: string): Promise<Lock> => {
    const response = await apiClient.post<Lock>('/api/v1/locks/acquire', {
      drawing_id: drawingId,
      user_id: userId,
    });
    return response.data;
  },

  /**
   * ロックを解放
   */
  releaseLock: async (drawingId: number, userId: string): Promise<void> => {
    await apiClient.delete('/api/v1/locks/release', {
      data: {
        drawing_id: drawingId,
        user_id: userId,
      },
    });
  },

  /**
   * ロック状態を確認
   */
  checkLock: async (drawingId: number): Promise<Lock | null> => {
    const response = await apiClient.get<Lock | null>(`/api/v1/locks/${drawingId}`);
    return response.data;
  },
};
