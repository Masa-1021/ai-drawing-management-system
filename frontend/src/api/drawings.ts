/**
 * 図面API
 */

import apiClient from './client';
import type { Drawing, DrawingListResponse, EditHistory, EditHistoryListResponse } from '../types/drawing';
import type { DrawingSpecInfo, UnlinkedDrawingsResponse } from '../types/spec-sheet';

export const drawingsApi = {
  /**
   * 図面をアップロード（複数ファイル対応）
   */
  upload: async (files: File[], runAnalysis = true): Promise<Drawing[]> => {
    console.log('[DEBUG] drawingsApi.upload called');
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file);
    });

    console.log('[DEBUG] FormData keys:', Array.from(formData.keys()));
    console.log('[DEBUG] Number of files:', files.length);
    console.log('[DEBUG] POST URL:', `/v1/drawings/upload?run_analysis=${runAnalysis}`);

    try {
      const response = await apiClient.post<Drawing[]>(
        `/v1/drawings/upload?run_analysis=${runAnalysis}`,
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
    const response = await apiClient.get<DrawingListResponse>('/v1/drawings/', {
      params,
    });

    return response.data;
  },

  /**
   * 図面を取得
   */
  get: async (id: string): Promise<Drawing> => {
    const response = await apiClient.get<Drawing>(`/v1/drawings/${id}`);
    return response.data;
  },

  /**
   * 図面を更新
   */
  update: async (
    id: string,
    data: Partial<Pick<Drawing, 'classification' | 'status' | 'summary'>>
  ): Promise<Drawing> => {
    const response = await apiClient.put<Drawing>(`/v1/drawings/${id}`, data);
    return response.data;
  },

  /**
   * 図面を承認
   */
  approve: async (id: string): Promise<Drawing> => {
    const response = await apiClient.put<Drawing>(`/v1/drawings/${id}/approve`);
    return response.data;
  },

  /**
   * 図面の承認を取り消し
   */
  unapprove: async (id: string): Promise<Drawing> => {
    const response = await apiClient.put<Drawing>(`/v1/drawings/${id}/unapprove`);
    return response.data;
  },

  /**
   * 図面を削除
   */
  delete: async (ids: string[]): Promise<{ deleted_count: number }> => {
    const response = await apiClient.delete('/v1/drawings/', {
      data: { drawing_ids: ids },
    });
    return response.data;
  },

  /**
   * 図面を一括削除（deleteのエイリアス）
   */
  bulkDelete: async (ids: string[]): Promise<{ deleted_count: number }> => {
    return drawingsApi.delete(ids);
  },

  /**
   * 図面を再解析
   */
  reanalyze: async (id: string): Promise<Drawing> => {
    const response = await apiClient.post<Drawing>(`/v1/drawings/${id}/reanalyze`, {}, {
      // AI解析には時間がかかるため、タイムアウトを5分に設定
      timeout: 300000, // 5分
    });
    return response.data;
  },

  /**
   * 宙に浮いた図面（摘要表に紐づいていない図面）一覧を取得
   */
  getUnlinked: async (params?: {
    page?: number;
    per_page?: number;
    search?: string;
  }): Promise<UnlinkedDrawingsResponse> => {
    const response = await apiClient.get<UnlinkedDrawingsResponse>('/v1/drawings/unlinked', {
      params,
    });
    return response.data;
  },

  /**
   * 図面の摘要表情報を取得
   */
  getSpecInfo: async (id: string): Promise<DrawingSpecInfo> => {
    const response = await apiClient.get<DrawingSpecInfo>(`/v1/drawings/${id}/spec-info`);
    return response.data;
  },

  /**
   * 図面を摘要表部品に紐づけ
   */
  linkToSpecItem: async (id: string, specSheetItemId: string): Promise<Drawing> => {
    const response = await apiClient.post<Drawing>(`/v1/drawings/${id}/link-spec-item`, {
      spec_sheet_item_id: specSheetItemId,
    });
    return response.data;
  },

  /**
   * 図面の摘要表紐づけを解除
   */
  unlinkFromSpecItem: async (id: string): Promise<Drawing> => {
    const response = await apiClient.post<Drawing>(`/v1/drawings/${id}/unlink-spec-item`);
    return response.data;
  },

  /**
   * 図面の図番から摘番を自動抽出・設定
   */
  extractSpecNumber: async (id: string): Promise<{ spec_number: string | null }> => {
    const response = await apiClient.post<{ spec_number: string | null }>(
      `/v1/drawings/${id}/extract-spec-number`
    );
    return response.data;
  },

  /**
   * 図面の編集履歴を取得
   */
  getEditHistory: async (id: string): Promise<EditHistoryListResponse> => {
    const response = await apiClient.get<EditHistoryListResponse>(
      `/v1/drawings/${id}/edit-history`
    );
    return response.data;
  },
};
