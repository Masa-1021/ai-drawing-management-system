/**
 * OracleLineImportDialog コンポーネント
 *
 * OracleDBからライン・設備をインポートするダイアログ
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Radio,
  RadioGroup,
  FormControlLabel,
  CircularProgress,
  Alert,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import { useOracleImport } from '../hooks/useOracleImport';

interface OracleLineImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export const OracleLineImportDialog = ({ open, onClose }: OracleLineImportDialogProps) => {
  const {
    lines,
    isLoadingLines,
    linesError,
    equipments,
    isLoadingEquipments,
    equipmentsError,
    selectedLineCode,
    handleLineSelect,
    executeImport,
    isImporting,
    importError,
  } = useOracleImport(open);

  const [searchQuery, setSearchQuery] = useState('');

  // ライン検索フィルタリング
  const filteredLines = lines.filter(
    (line) =>
      line.line_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      line.line_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 選択中のライン情報を取得
  const selectedLine = lines.find((line) => line.line_code === selectedLineCode);

  // 登録ボタンハンドラ
  const handleImport = () => {
    if (!selectedLine) return;

    executeImport({
      line_code: selectedLine.line_code,
      line_name: selectedLine.line_name,
      equipments: equipments.map((eq) => ({
        equipment_code: eq.equipment_code,
        equipment_name: eq.equipment_name,
      })),
    });

    // 成功時は親コンポーネントでリダイレクトされるため、ここではダイアログを閉じない
  };

  // キャンセルハンドラ
  const handleCancel = () => {
    setSearchQuery('');
    handleLineSelect('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle>OracleDBから新規ライン登録</DialogTitle>
      <DialogContent>
        {/* エラー表示 */}
        {linesError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            ライン一覧の取得に失敗しました: {String(linesError)}
          </Alert>
        )}
        {equipmentsError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            設備一覧の取得に失敗しました: {String(equipmentsError)}
          </Alert>
        )}
        {importError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            登録に失敗しました: {String(importError)}
          </Alert>
        )}

        {/* ライン検索 */}
        <TextField
          fullWidth
          label="ライン検索"
          placeholder="ラインコードまたはライン名で検索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
        />

        {/* ライン一覧 */}
        <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, mb: 2 }}>
          {isLoadingLines ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <RadioGroup value={selectedLineCode} onChange={(e) => handleLineSelect(e.target.value)}>
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {filteredLines.length === 0 ? (
                  <ListItem>
                    <ListItemText
                      primary="該当するラインが見つかりません"
                      sx={{ textAlign: 'center', color: 'text.secondary' }}
                    />
                  </ListItem>
                ) : (
                  filteredLines.map((line) => (
                    <ListItem key={line.line_code} disablePadding>
                      <ListItemButton onClick={() => handleLineSelect(line.line_code)}>
                        <FormControlLabel
                          value={line.line_code}
                          control={<Radio />}
                          label={
                            <Box>
                              <Typography variant="body1">{line.line_name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                ラインコード: {line.line_code}
                              </Typography>
                            </Box>
                          }
                          sx={{ width: '100%' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))
                )}
              </List>
            </RadioGroup>
          )}
        </Box>

        {/* 設備プレビュー */}
        {selectedLineCode && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              設備プレビュー（{equipments.length}件）
            </Typography>
            <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2 }}>
              {isLoadingEquipments ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : equipments.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                  このラインには設備が登録されていません
                </Typography>
              ) : (
                <List dense>
                  {equipments.map((equipment) => (
                    <ListItem key={equipment.equipment_code}>
                      <ListItemText
                        primary={equipment.equipment_name}
                        secondary={`設備コード: ${equipment.equipment_code}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel} disabled={isImporting}>
          キャンセル
        </Button>
        <Button
          onClick={handleImport}
          variant="contained"
          disabled={!selectedLineCode || isImporting}
          startIcon={isImporting ? <CircularProgress size={16} /> : null}
        >
          {isImporting ? '登録中...' : '登録'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
