/**
 * 摘番マスタ関連の型定義
 */

export interface SpecNumber {
  id: string;
  spec_number: string;
  title: string | null;
  model_name: string | null;
  material_code: string | null;
  usage_location: string | null;
  line_name: string | null;
  equipment_name: string | null;
  design_date: string | null;
  designer: string | null;
  reference_drawing: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpecNumberCreate {
  spec_number: string;
  title?: string;
  model_name?: string;
  material_code?: string;
  usage_location?: string;
  line_name?: string;
  equipment_name?: string;
  design_date?: string;
  designer?: string;
  reference_drawing?: string;
  remarks?: string;
}

export interface SpecNumberUpdate {
  spec_number?: string;
  title?: string;
  model_name?: string;
  material_code?: string;
  usage_location?: string;
  line_name?: string;
  equipment_name?: string;
  design_date?: string;
  designer?: string;
  reference_drawing?: string;
  remarks?: string;
}

export interface SpecNumberListParams {
  page?: number;
  per_page?: number;
  prefix?: string;
  spec_number?: string;
  title?: string;
  line_name?: string;
  equipment_name?: string;
  usage_location?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface SpecNumberListResponse {
  total: number;
  page: number;
  per_page: number;
  items: SpecNumber[];
}

export interface SpecNumberImportResponse {
  total_rows: number;
  imported: number;
  skipped: number;
  errors: string[];
}

export interface SpecNumberPrefixListResponse {
  prefixes: string[];
}

export interface SpecNumberNextResponse {
  next_spec_number: string;
  prefix: string;
  current_max_number: number;
}

export interface SpecNumberFilterOptionsResponse {
  prefixes: string[];
  line_names: string[];
  usage_locations: string[];
}
