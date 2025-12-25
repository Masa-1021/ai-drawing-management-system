/**
 * プロンプト管理API
 */

import { apiClient } from './client';
import type { Prompt, PromptListItem, PromptUpdate } from '../types/prompt';

const BASE_PATH = '/v1/prompts';

/**
 * プロンプト一覧取得
 */
export const fetchPrompts = async (): Promise<PromptListItem[]> => {
  const response = await apiClient.get<PromptListItem[]>(BASE_PATH);
  return response.data;
};

/**
 * プロンプト詳細取得
 */
export const fetchPrompt = async (promptName: string): Promise<Prompt> => {
  const response = await apiClient.get<Prompt>(`${BASE_PATH}/${promptName}`);
  return response.data;
};

/**
 * プロンプト更新
 */
export const updatePrompt = async (promptName: string, data: PromptUpdate): Promise<Prompt> => {
  const response = await apiClient.put<Prompt>(`${BASE_PATH}/${promptName}`, data);
  return response.data;
};
