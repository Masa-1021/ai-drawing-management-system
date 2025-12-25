/**
 * 設備関連の型定義
 */

export interface Equipment {
  id: string;
  line_id: string;
  code: string;
  name: string;
  description?: string;
  manufacturer?: string;
  model?: string;
  installed_date?: string;
  created_at: string;
  updated_at: string;
}

export interface EquipmentCreate {
  line_id: string;
  code: string;
  name: string;
  description?: string;
  manufacturer?: string;
  model?: string;
  installed_date?: string;
}

export interface EquipmentUpdate {
  line_id?: string;
  code?: string;
  name?: string;
  description?: string;
  manufacturer?: string;
  model?: string;
  installed_date?: string;
}
