/**
 * 摘要表関連の型定義
 */

// 部品タイプ
export type PartType = 'assembly' | 'unit' | 'part' | 'purchased';

// 摘要表ステータス
export type SpecSheetStatus = 'draft' | 'linked' | 'active';

// 摘要表改定履歴
export interface SpecSheetRevision {
  id: string;
  spec_sheet_id: string;
  revision_symbol: string;
  revision_date: string | null;
  description: string | null;
  created_by: string | null;
  checked_by: string | null;
  approved_by: string | null;
  remarks: string | null;
  created_at: string;
}

// 摘要表部品
export interface SpecSheetItem {
  id: string;
  spec_sheet_id: string;
  row_number: number;
  part_name: string | null;
  drawing_number: string | null;
  sub_number: string | null;
  item_number: string | null;
  material: string | null;
  heat_treatment: string | null;
  surface_treatment: string | null;
  quantity_per_set: number | null;
  required_quantity: number | null;
  revision: string | null;
  part_type: PartType;
  parent_item_id: string | null;
  parent_name: string | null;  // 親ユニット/組図名
  linked_drawing_id: string | null;
  web_link: string | null;  // 外部Webリンク（部品タイプのみ）
  created_at: string;
  updated_at: string;
  // フロントエンド用拡張フィールド
  linked_drawing?: {
    id: string;
    pdf_filename: string;
    thumbnail_path: string | null;
  } | null;
  child_items?: SpecSheetItem[];
}

// 摘要表
export interface SpecSheet {
  id: string;
  equipment_id: string | null;
  spec_number: string;
  equipment_name: string | null;
  line_name: string | null;
  model_name: string | null;
  order_number: string | null;
  created_by: string | null;
  checked_by: string | null;
  designed_by: string | null;
  approved_by: string | null;
  current_revision: string | null;
  file_path: string | null;
  original_filename: string | null;
  status: SpecSheetStatus;
  created_at: string;
  updated_at: string;
  // 一覧用フィールド
  item_count?: number;
  linked_count?: number;
  // リレーション
  revisions?: SpecSheetRevision[];
  items?: SpecSheetItem[];
  equipment?: {
    id: string;
    name: string;
    code: string;
    line_name?: string | null;
  } | null;
}

// 摘要表一覧レスポンス
export interface SpecSheetListResponse {
  total: number;
  page: number;
  per_page: number;
  items: SpecSheet[];
}

// 摘要表一覧パラメータ
export interface SpecSheetListParams {
  page?: number;
  per_page?: number;
  line_name?: string;
  equipment_name?: string;
  spec_number?: string;
  model_name?: string;
  created_by?: string;
  status?: SpecSheetStatus;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// 摘要表アップロードレスポンス
export interface SpecSheetUploadResponse {
  id: string;
  spec_number: string;
  equipment_name: string | null;
  line_name: string | null;
  item_count: number;
  revision_count: number;
  suggested_equipment: {
    equipment_id: string;
    equipment_name: string;
    line_name: string;
    confidence: number;
  } | null;
}

// 設備紐づけリクエスト
export interface LinkEquipmentRequest {
  equipment_id: string;
}

// 図面紐づけ候補
export interface DrawingLinkCandidate {
  spec_sheet_item_id: string;
  spec_sheet_item_row: number;
  spec_sheet_item_name: string | null;
  spec_sheet_item_drawing_number: string | null;
  drawing_id: string;
  drawing_filename: string;
  drawing_thumbnail: string | null;
  extracted_drawing_number: string | null;
  confidence: number;
}

// 図面紐づけリクエスト
export interface LinkDrawingsRequest {
  links: Array<{
    spec_sheet_item_id: string;
    drawing_id: string;
  }>;
}

// 図面紐づけレスポンス
export interface LinkDrawingsResponse {
  linked_count: number;
  errors: string[];
}

// 親更新リクエスト
export interface UpdateItemParentRequest {
  parent_item_id: string;
}

// 単一図面紐づけリクエスト
export interface LinkSingleDrawingRequest {
  drawing_id: string;
}

// 部品種別一括更新リクエスト
export interface BulkUpdatePartTypeRequest {
  item_ids: string[];
  part_type: PartType;
}

// 部品種別一括更新レスポンス
export interface BulkUpdatePartTypeResponse {
  updated_count: number;
  errors: string[];
}

// 図面紐づけ候補検索レスポンス
export interface FindMatchingDrawingsResponse {
  candidates: DrawingLinkCandidate[];
  total_unlinked: number;
}

// 宙に浮いた図面一覧レスポンス
export interface UnlinkedDrawingsResponse {
  total: number;
  page: number;
  per_page: number;
  items: Array<{
    id: string;
    pdf_filename: string;
    thumbnail_path: string | null;
    upload_date: string;
    classification: string | null;
    extracted_drawing_number: string | null;
  }>;
}

// 図面の摘要表情報
export interface DrawingSpecInfo {
  drawing: {
    id: string;
    pdf_filename: string;
    spec_number: string | null;
    spec_sheet_item_id: string | null;
  };
  spec_sheet_item: SpecSheetItem | null;
  spec_sheet: SpecSheet | null;
}

// Webリンク更新リクエスト
export interface UpdateWebLinkRequest {
  web_link: string | null;
}

// Webリンク更新レスポンス
export interface UpdateWebLinkResponse {
  id: string;
  web_link: string | null;
}
