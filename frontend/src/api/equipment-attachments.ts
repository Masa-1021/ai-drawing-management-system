/**
 * 設備添付ファイルAPI
 */

import { apiClient } from './client';
import type {
  EquipmentAttachment,
  EquipmentAttachmentListResponse,
  EquipmentAttachmentGroupedResponse,
  AttachmentCategory,
  EquipmentAttachmentUpdateRequest,
  EquipmentAttachmentVersionHistoryResponse,
} from '../types/equipment-attachment';

const BASE_PATH = '/v1/equipments';

/**
 * 設備の添付ファイル一覧取得
 */
export const getEquipmentAttachments = async (
  equipmentId: string,
  category?: AttachmentCategory,
  latestOnly: boolean = true
): Promise<EquipmentAttachmentListResponse> => {
  const params: Record<string, string | boolean> = { latest_only: latestOnly };
  if (category) params.category = category;
  const response = await apiClient.get<EquipmentAttachmentListResponse>(
    `${BASE_PATH}/${equipmentId}/attachments`,
    { params }
  );
  return response.data;
};

/**
 * サブカテゴリ別にグループ化された添付ファイル一覧取得
 */
export const getEquipmentAttachmentsGrouped = async (
  equipmentId: string,
  category: AttachmentCategory,
  latestOnly: boolean = true
): Promise<EquipmentAttachmentGroupedResponse> => {
  const response = await apiClient.get<EquipmentAttachmentGroupedResponse>(
    `${BASE_PATH}/${equipmentId}/attachments/grouped`,
    { params: { category, latest_only: latestOnly } }
  );
  return response.data;
};

/**
 * 添付ファイルアップロード
 */
export const uploadEquipmentAttachment = async (
  equipmentId: string,
  file: File,
  category: AttachmentCategory,
  subCategory: string,
  description?: string,
  version?: string
): Promise<EquipmentAttachment> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  formData.append('sub_category', subCategory);
  if (description) formData.append('description', description);
  if (version) formData.append('version', version);

  const response = await apiClient.post<EquipmentAttachment>(
    `${BASE_PATH}/${equipmentId}/attachments`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

/**
 * 添付ファイルバージョンアップ（更新）
 */
export const updateAttachmentVersion = async (
  equipmentId: string,
  attachmentId: string,
  file: File,
  description?: string
): Promise<EquipmentAttachment> => {
  const formData = new FormData();
  formData.append('file', file);
  if (description) formData.append('description', description);

  const response = await apiClient.post<EquipmentAttachment>(
    `${BASE_PATH}/${equipmentId}/attachments/${attachmentId}/update-version`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

/**
 * 添付ファイル詳細取得
 */
export const getEquipmentAttachment = async (
  equipmentId: string,
  attachmentId: string
): Promise<EquipmentAttachment> => {
  const response = await apiClient.get<EquipmentAttachment>(
    `${BASE_PATH}/${equipmentId}/attachments/${attachmentId}`
  );
  return response.data;
};

/**
 * 添付ファイルダウンロードURL取得
 */
export const getAttachmentDownloadUrl = (
  equipmentId: string,
  attachmentId: string
): string => {
  return `${apiClient.defaults.baseURL}${BASE_PATH}/${equipmentId}/attachments/${attachmentId}/download`;
};

/**
 * バージョン履歴取得
 */
export const getAttachmentVersionHistory = async (
  equipmentId: string,
  attachmentId: string
): Promise<EquipmentAttachmentVersionHistoryResponse> => {
  const response = await apiClient.get<EquipmentAttachmentVersionHistoryResponse>(
    `${BASE_PATH}/${equipmentId}/attachments/${attachmentId}/history`
  );
  return response.data;
};

/**
 * 添付ファイル更新
 */
export const updateEquipmentAttachment = async (
  equipmentId: string,
  attachmentId: string,
  data: EquipmentAttachmentUpdateRequest
): Promise<EquipmentAttachment> => {
  const response = await apiClient.patch<EquipmentAttachment>(
    `${BASE_PATH}/${equipmentId}/attachments/${attachmentId}`,
    data
  );
  return response.data;
};

/**
 * 添付ファイル削除
 */
export const deleteEquipmentAttachment = async (
  equipmentId: string,
  attachmentId: string
): Promise<void> => {
  await apiClient.delete(`${BASE_PATH}/${equipmentId}/attachments/${attachmentId}`);
};
