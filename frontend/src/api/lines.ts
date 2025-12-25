/**
 * ライン関連 API Client
 */

import { apiClient } from './client';
import type { Line, LineCreate, LineUpdate } from '../types/line';

/**
 * ライン一覧取得
 */
export const fetchLines = async (): Promise<Line[]> => {
  const response = await apiClient.get<Line[]>('/v1/lines');
  return response.data;
};

/**
 * ライン詳細取得
 */
export const fetchLine = async (lineId: string): Promise<Line> => {
  const response = await apiClient.get<Line>(`/v1/lines/${lineId}`);
  return response.data;
};

/**
 * ライン作成
 */
export const createLine = async (line: LineCreate): Promise<Line> => {
  const response = await apiClient.post<Line>('/v1/lines', line);
  return response.data;
};

/**
 * ライン更新
 */
export const updateLine = async (
  lineId: string,
  line: LineUpdate
): Promise<Line> => {
  const response = await apiClient.put<Line>(`/v1/lines/${lineId}`, line);
  return response.data;
};

/**
 * ライン削除
 */
export const deleteLine = async (lineId: string): Promise<void> => {
  await apiClient.delete(`/v1/lines/${lineId}`);
};
