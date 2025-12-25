/**
 * 設定API
 */

import apiClient from './client';
import type { Config } from '../types/drawing';

export const configApi = {
  /**
   * 設定を取得
   */
  getSettings: async (): Promise<Config> => {
    const response = await apiClient.get<Config>('/v1/config/settings');
    return response.data;
  },

  /**
   * 抽出フィールド設定を取得
   */
  getExtractionFields: async (): Promise<Array<{ name: string; required: boolean }>> => {
    const response = await apiClient.get<Array<{ name: string; required: boolean }>>(
      '/v1/config/extraction-fields'
    );
    return response.data;
  },
};
