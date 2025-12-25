/**
 * EquipmentSelectDialog コンポーネント
 *
 * 設備を選択するダイアログ（摘要表紐づけ用）
 */

import { useState, useMemo } from 'react';
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
  ListItemIcon,
  Radio,
  CircularProgress,
  Alert,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  PrecisionManufacturing as PrecisionManufacturingIcon,
} from '@mui/icons-material';
import { useLines } from '../hooks/useLines';
import { useEquipments } from '../hooks/useEquipments';

interface EquipmentSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (equipmentId: string, equipmentName: string, lineName: string) => void;
  currentEquipmentId?: string;
}

export const EquipmentSelectDialog = ({
  open,
  onClose,
  onSelect,
  currentEquipmentId,
}: EquipmentSelectDialogProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(
    currentEquipmentId || null
  );
  const [expandedLine, setExpandedLine] = useState<string | null>(null);

  // ライン一覧取得
  const {
    data: lines,
    isLoading: isLoadingLines,
    error: linesError,
  } = useLines();

  // 展開中ラインの設備取得
  const {
    data: equipments,
    isLoading: isLoadingEquipments,
  } = useEquipments(expandedLine || undefined);

  // 検索フィルタリング
  const filteredLines = useMemo(() => {
    if (!lines) return [];
    if (!searchQuery) return lines;

    const query = searchQuery.toLowerCase();
    return lines.filter(
      (line) =>
        line.name.toLowerCase().includes(query) ||
        (line.code?.toLowerCase().includes(query) ?? false)
    );
  }, [lines, searchQuery]);

  // 設備選択ハンドラ
  const handleEquipmentSelect = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId);
  };

  // 確定ボタンハンドラ
  const handleConfirm = () => {
    if (!selectedEquipmentId || !equipments || !lines) return;

    const equipment = equipments.find((eq) => eq.id === selectedEquipmentId);
    if (!equipment) return;

    const line = lines.find((l) => l.id === equipment.line_id);
    onSelect(
      equipment.id,
      equipment.name,
      line?.name || ''
    );
    handleClose();
  };

  // ダイアログを閉じる
  const handleClose = () => {
    setSearchQuery('');
    setSelectedEquipmentId(currentEquipmentId || null);
    setExpandedLine(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>設備を選択</DialogTitle>
      <DialogContent>
        {/* エラー表示 */}
        {linesError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            ライン一覧の取得に失敗しました: {String(linesError)}
          </Alert>
        )}

        {/* 検索フィールド */}
        <TextField
          fullWidth
          placeholder="ライン名・ラインコードで検索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        {/* ライン・設備リスト */}
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          {isLoadingLines ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : filteredLines.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {searchQuery ? '検索結果が見つかりません' : 'ラインがありません'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {filteredLines.map((line) => (
                <Accordion
                  key={line.id}
                  expanded={expandedLine === line.id}
                  onChange={() => setExpandedLine(expandedLine === line.id ? null : line.id)}
                  disableGutters
                  sx={{
                    '&:before': { display: 'none' },
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-of-type': { borderBottom: 'none' },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box>
                      <Typography variant="body1">{line.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {line.code}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    {isLoadingEquipments && expandedLine === line.id ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : equipments && equipments.length > 0 ? (
                      <List dense disablePadding>
                        {equipments.map((equipment) => (
                          <ListItem key={equipment.id} disablePadding>
                            <ListItemButton
                              onClick={() => handleEquipmentSelect(equipment.id)}
                              selected={selectedEquipmentId === equipment.id}
                            >
                              <ListItemIcon sx={{ minWidth: 36 }}>
                                <Radio
                                  checked={selectedEquipmentId === equipment.id}
                                  tabIndex={-1}
                                  disableRipple
                                />
                              </ListItemIcon>
                              <ListItemIcon sx={{ minWidth: 36 }}>
                                <PrecisionManufacturingIcon
                                  fontSize="small"
                                  color="action"
                                />
                              </ListItemIcon>
                              <ListItemText
                                primary={equipment.name}
                                secondary={equipment.code}
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Box sx={{ py: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          設備がありません
                        </Typography>
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>キャンセル</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!selectedEquipmentId}
        >
          選択
        </Button>
      </DialogActions>
    </Dialog>
  );
};
