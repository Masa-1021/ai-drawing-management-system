/**
 * 設備添付ファイルhooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEquipmentAttachments,
  getEquipmentAttachmentsGrouped,
  uploadEquipmentAttachment,
  updateEquipmentAttachment,
  deleteEquipmentAttachment,
  updateAttachmentVersion,
  getAttachmentVersionHistory,
} from '../api/equipment-attachments';
import type { AttachmentCategory, EquipmentAttachmentUpdateRequest } from '../types/equipment-attachment';

/**
 * 設備の添付ファイル一覧を取得
 */
export const useEquipmentAttachments = (
  equipmentId: string,
  category?: AttachmentCategory,
  latestOnly: boolean = true
) => {
  return useQuery({
    queryKey: ['equipment-attachments', equipmentId, category, latestOnly],
    queryFn: () => getEquipmentAttachments(equipmentId, category, latestOnly),
    enabled: !!equipmentId,
  });
};

/**
 * サブカテゴリ別にグループ化された添付ファイル一覧を取得
 */
export const useEquipmentAttachmentsGrouped = (
  equipmentId: string,
  category: AttachmentCategory,
  latestOnly: boolean = true
) => {
  return useQuery({
    queryKey: ['equipment-attachments-grouped', equipmentId, category, latestOnly],
    queryFn: () => getEquipmentAttachmentsGrouped(equipmentId, category, latestOnly),
    enabled: !!equipmentId && !!category,
  });
};

/**
 * 添付ファイルアップロード
 */
export const useUploadEquipmentAttachment = (equipmentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      category,
      subCategory,
      description,
      version,
    }: {
      file: File;
      category: AttachmentCategory;
      subCategory: string;
      description?: string;
      version?: string;
    }) => uploadEquipmentAttachment(equipmentId, file, category, subCategory, description, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-attachments', equipmentId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-attachments-grouped', equipmentId] });
    },
  });
};

/**
 * 添付ファイルバージョンアップ（更新）
 */
export const useUpdateAttachmentVersion = (equipmentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      attachmentId,
      file,
      description,
    }: {
      attachmentId: string;
      file: File;
      description?: string;
    }) => updateAttachmentVersion(equipmentId, attachmentId, file, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-attachments', equipmentId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-attachments-grouped', equipmentId] });
      queryClient.invalidateQueries({ queryKey: ['attachment-history'] });
    },
  });
};

/**
 * バージョン履歴取得
 */
export const useAttachmentVersionHistory = (equipmentId: string, attachmentId: string | null) => {
  return useQuery({
    queryKey: ['attachment-history', equipmentId, attachmentId],
    queryFn: () => getAttachmentVersionHistory(equipmentId, attachmentId!),
    enabled: !!equipmentId && !!attachmentId,
  });
};

/**
 * 添付ファイル更新
 */
export const useUpdateEquipmentAttachment = (equipmentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      attachmentId,
      data,
    }: {
      attachmentId: string;
      data: EquipmentAttachmentUpdateRequest;
    }) => updateEquipmentAttachment(equipmentId, attachmentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-attachments', equipmentId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-attachments-grouped', equipmentId] });
    },
  });
};

/**
 * 添付ファイル削除
 */
export const useDeleteEquipmentAttachment = (equipmentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) => deleteEquipmentAttachment(equipmentId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-attachments', equipmentId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-attachments-grouped', equipmentId] });
    },
  });
};
