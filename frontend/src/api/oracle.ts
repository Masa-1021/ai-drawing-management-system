/**
 * Oracle DB関連のAPI Client
 */

import { apiClient } from './client';
import type {
  OracleLine,
  OracleEquipment,
  OracleImportRequest,
  OracleImportResponse,
  OracleConnectionTestResponse,
} from '../types/oracle';

/**
 * Oracle DB接続テスト
 */
export const testOracleConnection = async (): Promise<OracleConnectionTestResponse> => {
  const response = await apiClient.get<OracleConnectionTestResponse>('/v1/oracle/test');
  return response.data;
};

/**
 * OracleDBからライン一覧を取得
 */
export const getLines = async (): Promise<OracleLine[]> => {
  const response = await apiClient.get<OracleLine[]>('/v1/oracle/lines');
  return response.data;
};

/**
 * 指定ラインの設備一覧を取得
 *
 * @param lineCode ラインコード (STA_NO2)
 */
export const getEquipments = async (lineCode: string): Promise<OracleEquipment[]> => {
  const response = await apiClient.get<OracleEquipment[]>('/v1/oracle/equipments', {
    params: { line_code: lineCode },
  });
  return response.data;
};

/**
 * OracleDBからライン・設備データをインポート
 *
 * @param request インポートリクエスト
 */
export const importLine = async (
  request: OracleImportRequest
): Promise<OracleImportResponse> => {
  const response = await apiClient.post<OracleImportResponse>('/v1/oracle/import', request);
  return response.data;
};
