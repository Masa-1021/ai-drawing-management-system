/**
 * プロンプト関連の型定義
 */

/**
 * プロンプト一覧アイテム
 */
export interface PromptListItem {
  name: string;
  label: string;
  preview: string;
  updated_at: string | null;
}

/**
 * プロンプト詳細
 */
export interface Prompt {
  name: string;
  label: string;
  content: string;
  file_path: string;
  updated_at: string | null;
}

/**
 * プロンプト更新リクエスト
 */
export interface PromptUpdate {
  content: string;
}
