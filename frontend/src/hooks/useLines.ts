/**
 * ライン関連のReact Queryカスタムフック
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchLines,
  fetchLine,
  createLine,
  updateLine,
  deleteLine,
} from '../api/lines';
import type { LineCreate, LineUpdate } from '../types/line';

/**
 * ライン一覧取得フック
 */
export const useLines = () => {
  return useQuery({
    queryKey: ['lines'],
    queryFn: async () => {
      try {
        return await fetchLines();
      } catch (error) {
        // API エラーの場合、サンプルデータを返す
        console.warn('Failed to fetch lines, using sample data');
        return [
          {
            id: 'sample-line-1',
            name: 'サンプルライン1',
            code: 'LINE-001',
            description: 'サンプルラインの説明',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      }
    },
  });
};

/**
 * ライン詳細取得フック
 */
export const useLine = (lineId: string) => {
  return useQuery({
    queryKey: ['lines', lineId],
    queryFn: () => fetchLine(lineId),
    enabled: !!lineId,
  });
};

/**
 * ライン作成フック
 */
export const useCreateLine = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (line: LineCreate) => createLine(line),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
    },
  });
};

/**
 * ライン更新フック
 */
export const useUpdateLine = () => {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    Error,
    { lineId: string; line: LineUpdate }
  >({
    mutationFn: ({ lineId, line }: { lineId: string; line: LineUpdate }) =>
      updateLine(lineId, line),
    onSuccess: (_data: unknown, variables: { lineId: string; line: LineUpdate }) => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      queryClient.invalidateQueries({ queryKey: ['lines', variables.lineId] });
    },
  });
};

/**
 * ライン削除フック
 */
export const useDeleteLine = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lineId: string) => deleteLine(lineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
    },
  });
};
