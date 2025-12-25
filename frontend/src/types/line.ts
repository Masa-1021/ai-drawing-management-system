/**
 * ライン関連の型定義
 */

export interface Line {
  id: string;
  name: string;
  code?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface LineCreate {
  name: string;
  code?: string;
  description?: string;
}

export interface LineUpdate {
  name?: string;
  code?: string;
  description?: string;
}
