/**
 * 設備添付ファイル型定義
 */

export type AttachmentCategory = 'soft' | 'manual' | 'inspection' | 'asset' | 'other';

export interface EquipmentAttachment {
  id: string;
  equipment_id: string;
  filename: string;
  stored_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string | null;
  category: AttachmentCategory;
  sub_category: string | null;
  description: string | null;
  version: string | null;
  version_group_id: string | null;
  is_latest: boolean;
  // 後方互換性
  soft_type: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface EquipmentAttachmentListResponse {
  total: number;
  items: EquipmentAttachment[];
}

export interface EquipmentAttachmentGroupedResponse {
  category: string;
  groups: Record<string, EquipmentAttachment[]>;
  total: number;
}

export interface EquipmentAttachmentUploadRequest {
  file: File;
  category: AttachmentCategory;
  sub_category: string;
  description?: string;
  version?: string;
}

export interface EquipmentAttachmentUpdateRequest {
  description?: string;
  version?: string;
  category?: AttachmentCategory;
  sub_category?: string;
}

export interface EquipmentAttachmentVersionHistoryResponse {
  current: EquipmentAttachment;
  history: EquipmentAttachment[];
}

// カテゴリの日本語ラベル
export const CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  soft: 'ソフト関連',
  manual: '取説',
  inspection: '点検マニュアル',
  asset: '資産情報',
  other: 'その他',
};

// カテゴリごとのサブカテゴリ定義
export const SUB_CATEGORIES: Record<AttachmentCategory, string[]> = {
  soft: ['PLC', 'GOT', 'サーボ', 'ロボット', 'その他'],
  manual: ['操作マニュアル', '保守マニュアル', '設置マニュアル', 'その他'],
  inspection: ['日常点検', '定期点検', '年次点検', 'その他'],
  asset: ['購入情報', '減価償却', '保険', 'その他'],
  other: ['その他'],
};

// ファイルサイズをフォーマット
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};
