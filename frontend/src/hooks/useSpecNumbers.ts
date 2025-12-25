/**
 * 摘番マスタ用React Queryフック
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSpecNumbers,
  getSpecNumber,
  createSpecNumber,
  updateSpecNumber,
  deleteSpecNumber,
  importSpecNumbers,
  getFilterOptions,
  getNextSpecNumber,
} from '../api/spec-numbers';
import type {
  SpecNumberListParams,
  SpecNumberCreate,
  SpecNumberUpdate,
} from '../types/spec-number';

// Query Keys
export const specNumberKeys = {
  all: ['spec-numbers'] as const,
  lists: () => [...specNumberKeys.all, 'list'] as const,
  list: (params: SpecNumberListParams) => [...specNumberKeys.lists(), params] as const,
  details: () => [...specNumberKeys.all, 'detail'] as const,
  detail: (id: string) => [...specNumberKeys.details(), id] as const,
};

/**
 * 摘番マスタ一覧取得フック
 */
export const useSpecNumbers = (params: SpecNumberListParams = {}) => {
  return useQuery({
    queryKey: specNumberKeys.list(params),
    queryFn: () => getSpecNumbers(params),
    staleTime: 5 * 60 * 1000, // 5分
  });
};

/**
 * 摘番マスタ詳細取得フック
 */
export const useSpecNumber = (id: string) => {
  return useQuery({
    queryKey: specNumberKeys.detail(id),
    queryFn: () => getSpecNumber(id),
    enabled: !!id,
  });
};

/**
 * 摘番マスタ作成フック
 */
export const useCreateSpecNumber = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SpecNumberCreate) => createSpecNumber(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: specNumberKeys.lists() });
    },
  });
};

/**
 * 摘番マスタ更新フック
 */
export const useUpdateSpecNumber = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SpecNumberUpdate }) => updateSpecNumber(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: specNumberKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: specNumberKeys.lists() });
    },
  });
};

/**
 * 摘番マスタ削除フック
 */
export const useDeleteSpecNumber = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSpecNumber(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: specNumberKeys.lists() });
    },
  });
};

/**
 * 摘番マスタExcelインポートフック
 */
export const useImportSpecNumbers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => importSpecNumbers(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: specNumberKeys.lists() });
    },
  });
};

/**
 * フィルタオプション取得フック
 */
export const useSpecNumberFilterOptions = () => {
  return useQuery({
    queryKey: [...specNumberKeys.all, 'filter-options'] as const,
    queryFn: () => getFilterOptions(),
    staleTime: 10 * 60 * 1000, // 10分
  });
};

/**
 * 次の摘番取得フック
 */
export const useNextSpecNumber = (prefix: string) => {
  return useQuery({
    queryKey: [...specNumberKeys.all, 'next', prefix] as const,
    queryFn: () => getNextSpecNumber(prefix),
    enabled: !!prefix && prefix.length === 1,
    retry: false, // エラー時はリトライしない
    staleTime: 0, // 常に最新を取得
  });
};
