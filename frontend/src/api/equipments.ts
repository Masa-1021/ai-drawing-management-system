/**
 * 設備関連 API Client
 */

import { apiClient } from './client';
import type { Equipment, EquipmentCreate, EquipmentUpdate } from '../types/equipment';
import type { Drawing } from '../types/drawing';

/**
 * 設備一覧取得
 */
export const fetchEquipments = async (lineId?: string): Promise<Equipment[]> => {
  const params = lineId ? { line_id: lineId } : {};
  const response = await apiClient.get<Equipment[]>('/v1/equipments', {
    params,
  });
  return response.data;
};

/**
 * 設備詳細取得
 */
export const fetchEquipment = async (equipmentId: string): Promise<Equipment> => {
  const response = await apiClient.get<Equipment>(
    `/v1/equipments/${equipmentId}`
  );
  return response.data;
};

/**
 * 設備に紐づく図面一覧取得
 */
export const fetchEquipmentDrawings = async (
  equipmentId: string
): Promise<Drawing[]> => {
  const response = await apiClient.get<Drawing[]>(
    `/v1/equipments/${equipmentId}/drawings`
  );
  return response.data;
};

/**
 * 設備作成
 */
export const createEquipment = async (
  equipment: EquipmentCreate
): Promise<Equipment> => {
  const response = await apiClient.post<Equipment>(
    '/v1/equipments',
    equipment
  );
  return response.data;
};

/**
 * 設備更新
 */
export const updateEquipment = async (
  equipmentId: string,
  equipment: EquipmentUpdate
): Promise<Equipment> => {
  const response = await apiClient.put<Equipment>(
    `/v1/equipments/${equipmentId}`,
    equipment
  );
  return response.data;
};

/**
 * 設備削除
 */
export const deleteEquipment = async (equipmentId: string): Promise<void> => {
  await apiClient.delete(`/v1/equipments/${equipmentId}`);
};
