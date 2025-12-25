/**
 * プロンプト用React Queryフック
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPrompts, fetchPrompt, updatePrompt } from '../api/prompts';
import type { PromptUpdate } from '../types/prompt';

// Query Keys
export const promptKeys = {
  all: ['prompts'] as const,
  lists: () => [...promptKeys.all, 'list'] as const,
  details: () => [...promptKeys.all, 'detail'] as const,
  detail: (name: string) => [...promptKeys.details(), name] as const,
};

/**
 * プロンプト一覧取得フック
 */
export const usePrompts = () => {
  return useQuery({
    queryKey: promptKeys.lists(),
    queryFn: fetchPrompts,
    staleTime: 5 * 60 * 1000, // 5分
  });
};

/**
 * プロンプト詳細取得フック
 */
export const usePrompt = (name: string) => {
  return useQuery({
    queryKey: promptKeys.detail(name),
    queryFn: () => fetchPrompt(name),
    enabled: !!name,
  });
};

/**
 * プロンプト更新フック
 */
export const useUpdatePrompt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: PromptUpdate }) => updatePrompt(name, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: promptKeys.detail(variables.name) });
      queryClient.invalidateQueries({ queryKey: promptKeys.lists() });
    },
  });
};
