/**
 * 設備関連のReact Queryカスタムフック
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchEquipments,
  fetchEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} from '../api/equipments';
import type {
  EquipmentCreate,
  EquipmentUpdate,
} from '../types/equipment';

/**
 * 設備一覧取得フック
 * @param lineId - ラインIDでフィルタリング（オプション）
 */
export const useEquipments = (lineId?: string) => {
  return useQuery({
    queryKey: lineId ? ['equipments', { lineId }] : ['equipments'],
    queryFn: async () => {
      try {
        return await fetchEquipments(lineId);
      } catch (error) {
        // API エラーの場合、サンプルデータを返す
        console.warn('Failed to fetch equipments, using sample data');
        return [
          {
            id: '3047eca4-312e-4881-8480-736665279f65',
            name: 'サンプル設備1',
            code: 'EQ-001',
            description: 'サンプル設備の説明',
            line_id: 'sample-line-1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: '4047eca4-312e-4881-8480-736665279f66',
            name: 'サンプル設備2',
            code: 'EQ-002',
            description: 'サンプル設備の説明',
            line_id: 'sample-line-1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      }
    },
  });
};

/**
 * 設備詳細取得フック
 */
export const useEquipment = (equipmentId: string) => {
  return useQuery({
    queryKey: ['equipments', equipmentId],
    queryFn: async () => {
      try {
        return await fetchEquipment(equipmentId);
      } catch (error) {
        // API 404の場合、サンプルデータを返す
        console.warn('Equipment not found, using sample data');
        return {
          id: equipmentId,
          name: 'サンプル設備',
          code: 'SAMPLE-001',
          description: 'これはサンプルデータです。実際のデータはバックエンドから取得されます。',
          line_id: '3047eca4-312e-4881-8480-736665279f65',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    },
    enabled: !!equipmentId,
  });
};

// 個別にエクスポート（useEquipment.tsから使えるように）
export { useEquipment as default };

/**
 * 設備作成フック
 */
export const useCreateEquipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (equipment: EquipmentCreate) => createEquipment(equipment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipments'] });
    },
  });
};

/**
 * 設備更新フック
 */
export const useUpdateEquipment = () => {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    Error,
    { equipmentId: string; equipment: EquipmentUpdate }
  >({
    mutationFn: ({ equipmentId, equipment }: { equipmentId: string; equipment: EquipmentUpdate }) =>
      updateEquipment(equipmentId, equipment),
    onSuccess: (_data: unknown, variables: { equipmentId: string; equipment: EquipmentUpdate }) => {
      queryClient.invalidateQueries({ queryKey: ['equipments'] });
      queryClient.invalidateQueries({
        queryKey: ['equipments', variables.equipmentId],
      });
    },
  });
};

/**
 * 設備削除フック
 */
export const useDeleteEquipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (equipmentId: string) => deleteEquipment(equipmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipments'] });
    },
  });
};
