/**
 * DrawingSelectDialog - 図面選択ダイアログ
 *
 * 摘要表の部品に紐づける図面を選択するダイアログ
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  InputAdornment,
  Chip,
  Paper,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Image as ImageIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { drawingsApi } from '../api/drawings';
import type { Drawing } from '../types/drawing';

interface DrawingSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (drawing: Drawing) => void;
  itemName?: string | null;
  itemDrawingNumber?: string | null;
}

export const DrawingSelectDialog = ({
  open,
  onClose,
  onSelect,
  itemName,
  itemDrawingNumber,
}: DrawingSelectDialogProps) => {
  const [searchText, setSearchText] = useState('');
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing | null>(null);

  // ダイアログが開いた時に検索テキストを図番で初期化
  useEffect(() => {
    if (open && itemDrawingNumber) {
      setSearchText(itemDrawingNumber);
    }
    if (!open) {
      setSelectedDrawing(null);
      setSearchText('');
    }
  }, [open, itemDrawingNumber]);

  // 図面一覧取得
  const { data, isLoading, error } = useQuery({
    queryKey: ['drawings', 'list-for-select'],
    queryFn: () => drawingsApi.list({ limit: 500 }),
    enabled: open,
    staleTime: 30 * 1000, // 30秒
  });

  // 検索フィルタリング
  const filteredDrawings = (data?.items || []).filter((drawing) => {
    if (!searchText.trim()) return true;
    const searchLower = searchText.toLowerCase();
    const filename = drawing.pdf_filename.toLowerCase();
    const originalFilename = drawing.original_filename.toLowerCase();

    // extracted_fieldsの中から図番を探す
    const drawingNumberField = drawing.extracted_fields.find(
      (f) => f.field_name === '図番' || f.field_name === '図面番号'
    );
    const extractedNumber = drawingNumberField?.field_value?.toLowerCase() || '';

    return (
      filename.includes(searchLower) ||
      originalFilename.includes(searchLower) ||
      extractedNumber.includes(searchLower)
    );
  });

  const handleSelect = () => {
    if (selectedDrawing) {
      onSelect(selectedDrawing);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="h6">図面を選択</Typography>
          {(itemName || itemDrawingNumber) && (
            <Typography variant="body2" color="text.secondary">
              紐づけ対象: {itemName && <strong>{itemName}</strong>}
              {itemDrawingNumber && (
                <Chip label={`図番: ${itemDrawingNumber}`} size="small" sx={{ ml: 1 }} />
              )}
            </Typography>
          )}
        </Box>
      </DialogTitle>
      <DialogContent>
        {/* 検索ボックス */}
        <Box sx={{ mb: 2, mt: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="図面を検索（ファイル名、図番）"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* ローディング */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* エラー */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            図面の取得に失敗しました
          </Alert>
        )}

        {/* 図面一覧 */}
        {!isLoading && !error && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {filteredDrawings.length}件の図面
            </Typography>

            {filteredDrawings.length === 0 ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 4,
                  textAlign: 'center',
                  color: 'text.secondary',
                }}
              >
                <ImageIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                <Typography>検索条件に一致する図面がありません</Typography>
              </Paper>
            ) : (
              <ImageList cols={4} gap={12} sx={{ maxHeight: 400, overflow: 'auto' }}>
                {filteredDrawings.map((drawing) => {
                  const isSelected = selectedDrawing?.id === drawing.id;
                  const hasSpecSheet = !!drawing.spec_sheet_item_id;

                  return (
                    <ImageListItem
                      key={drawing.id}
                      onClick={() => setSelectedDrawing(drawing)}
                      sx={{
                        cursor: 'pointer',
                        border: isSelected ? '2px solid' : '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        overflow: 'hidden',
                        position: 'relative',
                        '&:hover': {
                          borderColor: 'primary.light',
                        },
                      }}
                    >
                      {drawing.thumbnail_path ? (
                        <img
                          src={`/storage/thumbnails/${drawing.thumbnail_path}`}
                          alt={drawing.pdf_filename}
                          loading="lazy"
                          style={{
                            height: 120,
                            objectFit: 'contain',
                            backgroundColor: '#f5f5f5',
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            height: 120,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'grey.100',
                          }}
                        >
                          <ImageIcon sx={{ fontSize: 48, color: 'grey.400' }} />
                        </Box>
                      )}
                      {isSelected && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            bgcolor: 'primary.main',
                            borderRadius: '50%',
                            p: 0.25,
                          }}
                        >
                          <CheckCircleIcon sx={{ color: 'white', fontSize: 20 }} />
                        </Box>
                      )}
                      {hasSpecSheet && (
                        <Chip
                          label="紐づけ済"
                          size="small"
                          color="warning"
                          sx={{
                            position: 'absolute',
                            top: 4,
                            left: 4,
                            fontSize: 10,
                            height: 20,
                          }}
                        />
                      )}
                      <ImageListItemBar
                        title={drawing.pdf_filename}
                        subtitle={drawing.spec_number || drawing.classification || '未分類'}
                        sx={{
                          '& .MuiImageListItemBar-title': {
                            fontSize: 12,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          },
                          '& .MuiImageListItemBar-subtitle': {
                            fontSize: 10,
                          },
                        }}
                      />
                    </ImageListItem>
                  );
                })}
              </ImageList>
            )}
          </>
        )}

        {/* 選択中の図面情報 */}
        {selectedDrawing && (
          <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              選択中の図面
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {selectedDrawing.thumbnail_path ? (
                <Box
                  component="img"
                  src={`/storage/thumbnails/${selectedDrawing.thumbnail_path}`}
                  alt={selectedDrawing.pdf_filename}
                  sx={{ width: 80, height: 80, objectFit: 'contain', bgcolor: 'grey.100' }}
                />
              ) : (
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'grey.100',
                  }}
                >
                  <ImageIcon sx={{ color: 'grey.400' }} />
                </Box>
              )}
              <Box>
                <Typography variant="body1">{selectedDrawing.pdf_filename}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedDrawing.classification || '未分類'}
                </Typography>
                {selectedDrawing.spec_sheet_item_id && (
                  <Chip
                    label={`既に紐づけ済: ${selectedDrawing.spec_number || '摘番不明'}`}
                    color="warning"
                    size="small"
                    sx={{ mt: 0.5 }}
                  />
                )}
              </Box>
            </Box>
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          onClick={handleSelect}
          variant="contained"
          disabled={!selectedDrawing}
        >
          この図面を紐づける
        </Button>
      </DialogActions>
    </Dialog>
  );
};
