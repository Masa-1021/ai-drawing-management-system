/**
 * 設備図面関連のReact Queryカスタムフック
 */

import { useQuery } from '@tanstack/react-query';
import { fetchEquipmentDrawings } from '../api/equipments';

/**
 * 設備に紐づく図面一覧取得フック
 * 直接設備に紐づく図面と、摘要表経由で紐づく図面の両方を取得
 */
export const useEquipmentDrawings = (equipmentId: string) => {
  return useQuery({
    queryKey: ['equipments', equipmentId, 'drawings'],
    queryFn: () => fetchEquipmentDrawings(equipmentId),
    enabled: !!equipmentId,
  });
};
