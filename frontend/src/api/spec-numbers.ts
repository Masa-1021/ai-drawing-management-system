/**
 * 摘番マスタAPI
 */

import { apiClient } from './client';
import type {
  SpecNumber,
  SpecNumberCreate,
  SpecNumberUpdate,
  SpecNumberListParams,
  SpecNumberListResponse,
  SpecNumberImportResponse,
  SpecNumberFilterOptionsResponse,
  SpecNumberNextResponse,
} from '../types/spec-number';

const BASE_PATH = '/v1/spec-numbers';

/**
 * 摘番マスタExcelインポート
 */
export const importSpecNumbers = async (file: File): Promise<SpecNumberImportResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<SpecNumberImportResponse>(`${BASE_PATH}/import`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * 摘番マスタ一覧取得
 */
export const getSpecNumbers = async (params: SpecNumberListParams = {}): Promise<SpecNumberListResponse> => {
  const response = await apiClient.get<SpecNumberListResponse>(`${BASE_PATH}/`, { params });
  return response.data;
};

/**
 * 摘番マスタ詳細取得
 */
export const getSpecNumber = async (id: string): Promise<SpecNumber> => {
  const response = await apiClient.get<SpecNumber>(`${BASE_PATH}/${id}`);
  return response.data;
};

/**
 * 摘番マスタ作成
 */
export const createSpecNumber = async (data: SpecNumberCreate): Promise<SpecNumber> => {
  const response = await apiClient.post<SpecNumber>(`${BASE_PATH}/`, data);
  return response.data;
};

/**
 * 摘番マスタ更新
 */
export const updateSpecNumber = async (id: string, data: SpecNumberUpdate): Promise<SpecNumber> => {
  const response = await apiClient.put<SpecNumber>(`${BASE_PATH}/${id}`, data);
  return response.data;
};

/**
 * 摘番マスタ削除
 */
export const deleteSpecNumber = async (id: string): Promise<void> => {
  await apiClient.delete(`${BASE_PATH}/${id}`);
};

/**
 * フィルタオプション取得
 */
export const getFilterOptions = async (): Promise<SpecNumberFilterOptionsResponse> => {
  const response = await apiClient.get<SpecNumberFilterOptionsResponse>(`${BASE_PATH}/filter-options`);
  return response.data;
};

/**
 * 次の摘番取得
 */
export const getNextSpecNumber = async (prefix: string): Promise<SpecNumberNextResponse> => {
  const response = await apiClient.get<SpecNumberNextResponse>(`${BASE_PATH}/next/${prefix}`);
  return response.data;
};
