/**
 * 図面関連の型定義
 */

export interface ExtractedField {
  field_name: string;
  field_value: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Balloon {
  balloon_number?: string;  // 後方互換性のため保持
  part_name?: string;  // 後方互換性のため保持
  quantity?: number;  // 後方互換性のため保持
  upper_text?: string;  // 風船上部のテキスト
  lower_text?: string;  // 風船下部のテキスト
  adjacent_text?: string;  // 風船周辺のテキスト（型式、品名など）
  adjacent_position?: string;  // 付随テキストの位置
  confidence: number;
  x: number;  // 座標（小数点を含む場合がある）
  y: number;  // 座標（小数点を含む場合がある）
  coordinates?: {  // 風船の矩形座標（クリック時のズーム用）
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Revision {
  revision_number: string;
  revision_date?: string;
  description?: string;
  author?: string;
  confidence: number;
}

export interface Tag {
  id: number;
  tag_name: string;
  created_at: string;
}

// 摘要表部品情報（図面一覧表示用）
export interface SpecSheetItemInfo {
  id: string;
  row_number: number;
  part_name: string | null;
  drawing_number: string | null;
  spec_sheet_id: string;
  spec_number: string;
  equipment_name: string | null;
  line_name: string | null;
}

export interface Drawing {
  id: string; // UUID
  original_filename: string; // 元のファイル名
  pdf_filename: string; // 表示用ファイル名（編集可能）
  pdf_path: string; // 実際のファイルパス（UUID形式）
  page_number: number;
  thumbnail_path?: string;
  status: 'pending' | 'analyzing' | 'approved' | 'unapproved' | 'failed';
  classification?: string;
  classification_confidence?: number;
  rotation?: number; // AIで検出された回転角度 (0, 90, 180, 270)
  upload_date: string;
  analyzed_at?: string;
  approved_date?: string;
  created_by: string;
  summary?: string;
  shape_features?: Record<string, unknown>;
  extracted_fields: ExtractedField[];
  balloons: Balloon[];
  revisions: Revision[];
  tags: Tag[];
  // 摘要表関連
  spec_sheet_item_id?: string;
  spec_number?: string;
  spec_sheet_item?: SpecSheetItemInfo;
}

export interface DrawingListResponse {
  total: number;
  items: Drawing[];
}

export interface Config {
  extraction_fields: Array<{
    name: string;
    required: boolean;
  }>;
  lock_timeout: number;
  retry_attempts: number;
  confidence_threshold: number;
}

export interface EditHistory {
  id: number;
  drawing_id: string;
  user_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  timestamp: string;
}

export interface EditHistoryListResponse {
  total: number;
  items: EditHistory[];
}
