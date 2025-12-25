/**
 * SpecNumberImportDialog コンポーネント
 *
 * 摘番マスタExcelをインポートするダイアログ
 */

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Box,
  Typography,
  CircularProgress,
  LinearProgress,
  Paper,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useImportSpecNumbers } from '../hooks/useSpecNumbers';

interface SpecNumberImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SpecNumberImportDialog = ({
  open,
  onClose,
  onSuccess,
}: SpecNumberImportDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const {
    mutate: importMutation,
    isPending: isImporting,
    error: importError,
    data: importResult,
    reset: resetMutation,
  } = useImportSpecNumbers();

  // ファイルドロップハンドラ
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const droppedFile = files[0];
      if (droppedFile.name.endsWith('.xlsx')) {
        setFile(droppedFile);
        resetMutation();
      }
    }
  }, [resetMutation]);

  // ファイル選択ハンドラ
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
      resetMutation();
    }
  };

  // インポート実行
  const handleImport = () => {
    if (!file) return;

    importMutation(file, {
      onSuccess: () => {
        onSuccess?.();
      },
    });
  };

  // ダイアログを閉じる
  const handleClose = () => {
    setFile(null);
    resetMutation();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>摘番マスタExcelインポート</DialogTitle>
      <DialogContent>
        {/* エラー表示 */}
        {importError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            インポートに失敗しました: {String(importError)}
          </Alert>
        )}

        {/* 成功結果表示 */}
        {importResult && (
          <Alert
            severity={importResult.errors.length > 0 ? 'warning' : 'success'}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2">
              処理完了: {importResult.total_rows}行中 {importResult.imported}件インポート
            </Typography>
            {importResult.skipped > 0 && (
              <Typography variant="body2">
                スキップ: {importResult.skipped}件（重複）
              </Typography>
            )}
            {importResult.errors.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="error">
                  エラー: {importResult.errors.length}件
                </Typography>
                <Box
                  component="ul"
                  sx={{ m: 0, pl: 2, maxHeight: 100, overflow: 'auto', fontSize: '0.875rem' }}
                >
                  {importResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {importResult.errors.length > 5 && (
                    <li>...他{importResult.errors.length - 5}件</li>
                  )}
                </Box>
              </Box>
            )}
          </Alert>
        )}

        {/* ファイルドロップエリア */}
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            textAlign: 'center',
            backgroundColor: dragActive ? 'action.hover' : 'background.paper',
            borderStyle: 'dashed',
            borderColor: dragActive ? 'primary.main' : 'divider',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'action.hover',
            },
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('spec-number-file-input')?.click()}
        >
          <input
            id="spec-number-file-input"
            type="file"
            accept=".xlsx"
            hidden
            onChange={handleFileSelect}
          />
          {isImporting ? (
            <Box>
              <CircularProgress size={48} sx={{ mb: 2 }} />
              <Typography variant="body1">インポート中...</Typography>
              <LinearProgress sx={{ mt: 2, width: '80%', mx: 'auto' }} />
            </Box>
          ) : file ? (
            <Box>
              {importResult ? (
                importResult.errors.length > 0 ? (
                  <ErrorIcon color="warning" sx={{ fontSize: 48, mb: 1 }} />
                ) : (
                  <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
                )
              ) : (
                <CloudUploadIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
              )}
              <Typography variant="body1">{file.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {(file.size / 1024).toFixed(1)} KB
              </Typography>
            </Box>
          ) : (
            <Box>
              <CloudUploadIcon color="action" sx={{ fontSize: 48, mb: 1 }} />
              <Typography variant="body1">
                摘番一括検索Excelファイル (.xlsx) をドロップまたはクリックして選択
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ファイル形式: .xlsx
              </Typography>
            </Box>
          )}
        </Paper>

        {/* 説明 */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            摘番一括検索Excelファイル（.xlsx）をインポートします。既存の摘番と重複するものはスキップされます。
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isImporting}>
          {importResult ? '閉じる' : 'キャンセル'}
        </Button>
        {!importResult && (
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={!file || isImporting}
            startIcon={isImporting ? <CircularProgress size={16} /> : <CloudUploadIcon />}
          >
            {isImporting ? 'インポート中...' : 'インポート'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
