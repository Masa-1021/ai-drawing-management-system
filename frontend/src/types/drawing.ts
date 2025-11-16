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
  balloon_number: string;
  part_name?: string;
  quantity: number;
  confidence: number;
  x: number;
  y: number;
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
