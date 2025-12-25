/**
 * Oracle DB関連の型定義
 */

/**
 * OracleDBから取得したライン情報
 */
export interface OracleLine {
  line_code: string; // ラインコード (STA_NO2)
  line_name: string; // ライン名 (LINE_NAME)
}

/**
 * OracleDBから取得した設備情報
 */
export interface OracleEquipment {
  equipment_code: string; // 設備コード (STA_NO3)
  equipment_name: string; // 設備名 (ST_NAME)
}

/**
 * Oracle DBからのインポートリクエスト
 */
export interface OracleImportRequest {
  line_code: string; // インポートするラインコード
  line_name: string; // ライン名
  equipments: OracleEquipment[]; // ラインに紐づく設備リスト
}

/**
 * Oracle DBからのインポートレスポンス
 */
export interface OracleImportResponse {
  line_id: string; // 作成されたラインのID
  line_name: string; // ライン名
  equipment_count: number; // 登録された設備数
  created_at: string; // 登録日時 (ISO 8601)
}

/**
 * Oracle DB接続テストレスポンス
 */
export interface OracleConnectionTestResponse {
  success: boolean; // 接続成功フラグ
  message: string; // メッセージ
  oracle_version: string | null; // Oracleバージョン情報
}
