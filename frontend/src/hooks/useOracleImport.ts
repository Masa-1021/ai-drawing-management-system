/**
 * Oracle Import カスタムフック
 *
 * OracleDBからのライン・設備インポート処理を管理
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as oracleApi from '../api/oracle';
import type { OracleImportRequest } from '../types/oracle';

export const useOracleImport = (enabled: boolean = false) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedLineCode, setSelectedLineCode] = useState<string>('');

  // ライン一覧取得
  const {
    data: linesData,
    isLoading: isLoadingLines,
    error: linesError,
  } = useQuery({
    queryKey: ['oracle', 'lines'],
    queryFn: oracleApi.getLines,
    retry: 1,
    enabled: enabled, // ダイアログが開いているときのみ実行
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
  });

  // 設備一覧取得（ライン選択時のみ）
  const {
    data: equipmentsData,
    isLoading: isLoadingEquipments,
    error: equipmentsError,
  } = useQuery({
    queryKey: ['oracle', 'equipments', selectedLineCode],
    queryFn: () => oracleApi.getEquipments(selectedLineCode),
    enabled: enabled && !!selectedLineCode, // ダイアログが開いていてラインコードが選択されている場合のみ実行
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  // インポート処理
  const importMutation = useMutation({
    mutationFn: (request: OracleImportRequest) => oracleApi.importLine(request),
    onSuccess: (data) => {
      // キャッシュを無効化（ライン・設備一覧を再取得）
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      queryClient.invalidateQueries({ queryKey: ['equipments'] });

      // 成功メッセージ（親コンポーネントで処理）
      console.log(`ライン「${data.line_name}」を登録しました（設備数: ${data.equipment_count}）`);

      // 新規ラインの詳細ページにリダイレクト
      navigate(`/equipment/${data.line_id}`);
    },
    onError: (error) => {
      console.error('インポートエラー:', error);
      // エラー処理（親コンポーネントで処理）
    },
  });

  // ライン選択ハンドラ
  const handleLineSelect = (lineCode: string) => {
    setSelectedLineCode(lineCode);
  };

  // インポート実行
  const executeImport = (request: OracleImportRequest) => {
    importMutation.mutate(request);
  };

  return {
    // ライン一覧
    lines: linesData || [],
    isLoadingLines,
    linesError,

    // 設備一覧
    equipments: equipmentsData || [],
    isLoadingEquipments,
    equipmentsError,

    // 選択状態
    selectedLineCode,
    handleLineSelect,

    // インポート処理
    executeImport,
    isImporting: importMutation.isPending,
    importError: importMutation.error,
  };
};
