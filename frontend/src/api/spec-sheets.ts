/**
 * 摘要表API
 */

import { apiClient } from './client';
import type {
  SpecSheet,
  SpecSheetItem,
  SpecSheetListParams,
  SpecSheetListResponse,
  SpecSheetUploadResponse,
  LinkEquipmentRequest,
  FindMatchingDrawingsResponse,
  LinkDrawingsRequest,
  LinkDrawingsResponse,
  UpdateItemParentRequest,
  BulkUpdatePartTypeRequest,
  BulkUpdatePartTypeResponse,
  LinkSingleDrawingRequest,
  UpdateWebLinkRequest,
  UpdateWebLinkResponse,
} from '../types/spec-sheet';

const BASE_PATH = '/v1/spec-sheets';

/**
 * 摘要表Excelアップロード
 */
export const uploadSpecSheet = async (
  file: File,
  equipmentId?: string
): Promise<SpecSheetUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  if (equipmentId) {
    formData.append('equipment_id', equipmentId);
  }

  const response = await apiClient.post<SpecSheetUploadResponse>(`${BASE_PATH}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * 摘要表一覧取得
 */
export const getSpecSheets = async (params: SpecSheetListParams = {}): Promise<SpecSheetListResponse> => {
  const response = await apiClient.get<SpecSheetListResponse>(`${BASE_PATH}/`, { params });
  return response.data;
};

/**
 * 摘要表詳細取得
 */
export const getSpecSheet = async (id: string): Promise<SpecSheet> => {
  const response = await apiClient.get<SpecSheet>(`${BASE_PATH}/${id}`);
  return response.data;
};

/**
 * 摘要表更新
 */
export const updateSpecSheet = async (
  id: string,
  data: Partial<Pick<SpecSheet, 'equipment_name' | 'line_name' | 'model_name' | 'status'>>
): Promise<SpecSheet> => {
  const response = await apiClient.put<SpecSheet>(`${BASE_PATH}/${id}`, data);
  return response.data;
};

/**
 * 摘要表削除
 */
export const deleteSpecSheet = async (id: string): Promise<void> => {
  await apiClient.delete(`${BASE_PATH}/${id}`);
};

/**
 * 摘要表を設備に紐づけ
 */
export const linkSpecSheetToEquipment = async (
  specSheetId: string,
  request: LinkEquipmentRequest
): Promise<SpecSheet> => {
  const response = await apiClient.post<SpecSheet>(
    `${BASE_PATH}/${specSheetId}/link-equipment`,
    request
  );
  return response.data;
};

/**
 * 紐づけ候補の図面を検索
 */
export const findMatchingDrawings = async (specSheetId: string): Promise<FindMatchingDrawingsResponse> => {
  const response = await apiClient.post<FindMatchingDrawingsResponse>(
    `${BASE_PATH}/${specSheetId}/find-matching-drawings`
  );
  return response.data;
};

/**
 * 図面を一括紐づけ
 */
export const linkDrawingsToSpecSheet = async (
  specSheetId: string,
  request: LinkDrawingsRequest
): Promise<LinkDrawingsResponse> => {
  const response = await apiClient.post<LinkDrawingsResponse>(
    `${BASE_PATH}/${specSheetId}/link-drawings`,
    request
  );
  return response.data;
};

/**
 * 部品の親を更新
 */
export const updateItemParent = async (
  specSheetId: string,
  itemId: string,
  request: UpdateItemParentRequest
): Promise<SpecSheetItem> => {
  const response = await apiClient.patch<SpecSheetItem>(
    `${BASE_PATH}/${specSheetId}/items/${itemId}/parent`,
    request
  );
  return response.data;
};

/**
 * 部品種別を一括更新
 */
export const bulkUpdatePartType = async (
  specSheetId: string,
  request: BulkUpdatePartTypeRequest
): Promise<BulkUpdatePartTypeResponse> => {
  const response = await apiClient.patch<BulkUpdatePartTypeResponse>(
    `${BASE_PATH}/${specSheetId}/items/bulk-update-type`,
    request
  );
  return response.data;
};

/**
 * 部品に図面を紐づけ
 */
export const linkDrawingToItem = async (
  specSheetId: string,
  itemId: string,
  request: LinkSingleDrawingRequest
): Promise<SpecSheetItem> => {
  const response = await apiClient.post<SpecSheetItem>(
    `${BASE_PATH}/${specSheetId}/items/${itemId}/link-drawing`,
    request
  );
  return response.data;
};

/**
 * 部品から図面の紐づけを解除
 */
export const unlinkDrawingFromItem = async (
  specSheetId: string,
  itemId: string
): Promise<SpecSheetItem> => {
  const response = await apiClient.delete<SpecSheetItem>(
    `${BASE_PATH}/${specSheetId}/items/${itemId}/link-drawing`
  );
  return response.data;
};

/**
 * 部品のWebリンクを更新
 */
export const updateItemWebLink = async (
  specSheetId: string,
  itemId: string,
  request: UpdateWebLinkRequest
): Promise<UpdateWebLinkResponse> => {
  const response = await apiClient.patch<UpdateWebLinkResponse>(
    `${BASE_PATH}/${specSheetId}/items/${itemId}/web-link`,
    request
  );
  return response.data;
};
