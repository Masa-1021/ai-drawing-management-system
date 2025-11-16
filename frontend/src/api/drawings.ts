/**
 * 図面API
 */

import apiClient from './client';
import type { Drawing, DrawingListResponse } from '../types/drawing';

export const drawingsApi = {
  /**
   * 図面をアップロード
   */
  upload: async (file: File, runAnalysis = true): Promise<Drawing[]> => {
    console.log('[DEBUG] drawingsApi.upload called');
    const formData = new FormData();
    formData.append('file', file);

    console.log('[DEBUG] FormData keys:', Array.from(formData.keys()));
    console.log('[DEBUG] FormData file:', formData.get('file'));
    console.log('[DEBUG] POST URL:', `/api/v1/drawings/upload?run_analysis=${runAnalysis}`);

    try {
      const response = await apiClient.post<Drawing[]>(
        `/api/v1/drawings/upload?run_analysis=${runAnalysis}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          // AI解析には時間がかかるため、タイムアウトを5分に設定
          timeout: 300000, // 5分
        }
      );
      console.log('[DEBUG] API response:', response);
      return response.data;
    } catch (error) {
      console.error('[ERROR] API upload failed:', error);
      if (
        error &&
        typeof error === 'object' &&
        error !== null &&
        'response' in error
      ) {
        // @ts-ignore
        console.log('[ERROR] API error response:', error.response);
      }
      throw error;
    }
  },

  /**
   * 図面リストを取得
   */
  list: async (params?: {
    skip?: number;
    limit?: number;
    status?: string;
    classification?: string;
  }): Promise<DrawingListResponse> => {
    const response = await apiClient.get<DrawingListResponse>('/api/v1/drawings/', {
      params,
    });

    return response.data;
  },

  /**
   * 図面を取得
   */
  get: async (id: string): Promise<Drawing> => {
    const response = await apiClient.get<Drawing>(`/api/v1/drawings/${id}`);
    return response.data;
  },

  /**
   * 図面を更新
   */
  update: async (
    id: string,
    data: Partial<Pick<Drawing, 'classification' | 'status' | 'summary'>>
  ): Promise<Drawing> => {
    const response = await apiClient.put<Drawing>(`/api/v1/drawings/${id}`, data);
    return response.data;
  },

  /**
   * 図面を承認
   */
  approve: async (id: string): Promise<Drawing> => {
    const response = await apiClient.put<Drawing>(`/api/v1/drawings/${id}/approve`);
    return response.data;
  },

  /**
   * 図面の承認を取り消し
   */
  unapprove: async (id: string): Promise<Drawing> => {
    const response = await apiClient.put<Drawing>(`/api/v1/drawings/${id}/unapprove`);
    return response.data;
  },

  /**
   * 図面を削除
   */
  delete: async (ids: string[]): Promise<{ deleted_count: number }> => {
    const response = await apiClient.delete('/api/v1/drawings/', {
      data: { drawing_ids: ids },
    });
    return response.data;
  },

  /**
   * 図面を再解析
   */
  reanalyze: async (id: string): Promise<Drawing> => {
    const response = await apiClient.post<Drawing>(`/api/v1/drawings/${id}/reanalyze`, {}, {
      // AI解析には時間がかかるため、タイムアウトを5分に設定
      timeout: 300000, // 5分
    });
    return response.data;
  },
};
