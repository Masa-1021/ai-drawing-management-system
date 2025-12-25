/**
 * SpecSheetUploadDialog コンポーネント
 *
 * 摘要表Excelをアップロードするダイアログ
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
  Stepper,
  Step,
  StepLabel,
  Chip,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  Link as LinkIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useUploadSpecSheet, useLinkSpecSheetToEquipment } from '../hooks/useSpecSheets';
import type { SpecSheetUploadResponse } from '../types/spec-sheet';

interface SpecSheetUploadDialogProps {
  open: boolean;
  onClose: () => void;
  equipmentId?: string;
  onSuccess?: (specSheetId: string) => void;
}

const steps = ['ファイル選択', '解析', '設備紐づけ'];

export const SpecSheetUploadDialog = ({
  open,
  onClose,
  equipmentId,
  onSuccess,
}: SpecSheetUploadDialogProps) => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [uploadResult, setUploadResult] = useState<SpecSheetUploadResponse | null>(null);

  const {
    mutate: uploadMutation,
    isPending: isUploading,
    error: uploadError,
    reset: resetUpload,
  } = useUploadSpecSheet();

  const {
    mutate: linkMutation,
    isPending: isLinking,
    error: linkError,
  } = useLinkSpecSheetToEquipment();

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
      if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xlsm')) {
        setFile(droppedFile);
        resetUpload();
        setUploadResult(null);
        setActiveStep(0);
      }
    }
  }, [resetUpload]);

  // ファイル選択ハンドラ
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
      resetUpload();
      setUploadResult(null);
      setActiveStep(0);
    }
  };

  // アップロード実行
  const handleUpload = () => {
    if (!file) return;

    setActiveStep(1);
    uploadMutation(
      { file, equipmentId },
      {
        onSuccess: (result) => {
          setUploadResult(result);
          setActiveStep(2);
        },
        onError: () => {
          setActiveStep(0);
        },
      }
    );
  };

  // 設備紐づけ実行
  const handleLinkEquipment = (targetEquipmentId: string) => {
    if (!uploadResult) return;

    linkMutation(
      {
        specSheetId: uploadResult.id,
        request: { equipment_id: targetEquipmentId },
      },
      {
        onSuccess: () => {
          onSuccess?.(uploadResult.id);
          handleClose();
          navigate(`/spec-sheets/${uploadResult.id}`);
        },
      }
    );
  };

  // 紐づけスキップ
  const handleSkipLink = () => {
    if (!uploadResult) return;
    onSuccess?.(uploadResult.id);
    handleClose();
    navigate(`/spec-sheets/${uploadResult.id}`);
  };

  // ダイアログを閉じる
  const handleClose = () => {
    setFile(null);
    setUploadResult(null);
    setActiveStep(0);
    resetUpload();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>摘要表Excelアップロード</DialogTitle>
      <DialogContent>
        {/* ステッパー */}
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* エラー表示 */}
        {uploadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            アップロードに失敗しました: {String(uploadError)}
          </Alert>
        )}
        {linkError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            設備紐づけに失敗しました: {String(linkError)}
          </Alert>
        )}

        {/* Step 0: ファイル選択 */}
        {activeStep === 0 && (
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
            onClick={() => document.getElementById('spec-sheet-file-input')?.click()}
          >
            <input
              id="spec-sheet-file-input"
              type="file"
              accept=".xlsx,.xlsm"
              hidden
              onChange={handleFileSelect}
            />
            {file ? (
              <Box>
                <CloudUploadIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
                <Typography variant="body1">{file.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {(file.size / 1024).toFixed(1)} KB
                </Typography>
              </Box>
            ) : (
              <Box>
                <CloudUploadIcon color="action" sx={{ fontSize: 48, mb: 1 }} />
                <Typography variant="body1">
                  摘要表Excelファイル (.xlsx, .xlsm) をドロップまたはクリックして選択
                </Typography>
              </Box>
            )}
          </Paper>
        )}

        {/* Step 1: 解析中 */}
        {activeStep === 1 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="body1">摘要表を解析中...</Typography>
            <LinearProgress sx={{ mt: 2, width: '80%', mx: 'auto' }} />
          </Box>
        )}

        {/* Step 2: 設備紐づけ */}
        {activeStep === 2 && uploadResult && (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2">
                摘要表「{uploadResult.spec_number}」のアップロードが完了しました
              </Typography>
            </Alert>

            {/* 解析結果サマリー */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                解析結果
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={`摘番: ${uploadResult.spec_number}`}
                  size="small"
                  color="primary"
                />
                {uploadResult.line_name && (
                  <Chip
                    label={`ライン: ${uploadResult.line_name}`}
                    size="small"
                  />
                )}
                {uploadResult.equipment_name && (
                  <Chip
                    label={`設備: ${uploadResult.equipment_name}`}
                    size="small"
                  />
                )}
                <Chip
                  label={`部品数: ${uploadResult.item_count}`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </Paper>

            {/* 設備サジェスト */}
            {uploadResult.suggested_equipment ? (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CheckCircleIcon color="success" fontSize="small" />
                  <Typography variant="subtitle2">
                    既存設備との一致が見つかりました
                  </Typography>
                  <Chip
                    label={`${Math.round(uploadResult.suggested_equipment.confidence * 100)}%一致`}
                    size="small"
                    color={uploadResult.suggested_equipment.confidence >= 0.8 ? 'success' : 'warning'}
                  />
                </Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {uploadResult.suggested_equipment.line_name} &gt;{' '}
                  {uploadResult.suggested_equipment.equipment_name}
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<LinkIcon />}
                  onClick={() =>
                    handleLinkEquipment(uploadResult.suggested_equipment!.equipment_id)
                  }
                  disabled={isLinking}
                >
                  この設備に紐づける
                </Button>
              </Paper>
            ) : (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <WarningIcon color="warning" fontSize="small" />
                  <Typography variant="subtitle2">
                    一致する設備が見つかりませんでした
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  摘要表詳細ページから手動で設備を選択してください。
                </Typography>
              </Paper>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isUploading || isLinking}>
          キャンセル
        </Button>
        {activeStep === 0 && (
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={!file || isUploading}
            startIcon={isUploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
          >
            アップロード
          </Button>
        )}
        {activeStep === 2 && (
          <Button
            onClick={handleSkipLink}
            variant="outlined"
            disabled={isLinking}
          >
            後で紐づける
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
