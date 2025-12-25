/**
 * PromptSettingsPage - プロンプト設定ページ
 *
 * AI解析に使用するプロンプトの閲覧・編集ページ
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Chip,
} from '@mui/material';
import { Code as CodeIcon, Save as SaveIcon } from '@mui/icons-material';
import { usePrompts, usePrompt, useUpdatePrompt } from '../hooks/usePrompts';
import toast from 'react-hot-toast';
import type { PromptListItem } from '../types/prompt';

export const PromptSettingsPage = () => {
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // データ取得
  const { data: prompts, isLoading, error } = usePrompts();
  const { data: promptDetail, isLoading: isLoadingDetail } = usePrompt(selectedPrompt ?? '');
  const { mutateAsync: updatePromptMutation, isPending: isUpdating } = useUpdatePrompt();

  // プロンプト選択
  const handleSelectPrompt = (name: string) => {
    setSelectedPrompt(name);
    setDialogOpen(true);
  };

  // ダイアログが開いたときにコンテンツをセット
  useEffect(() => {
    if (dialogOpen && promptDetail) {
      setEditContent(promptDetail.content);
    }
  }, [dialogOpen, promptDetail]);

  // 保存処理
  const handleSave = async () => {
    if (!selectedPrompt) return;

    try {
      await updatePromptMutation({
        name: selectedPrompt,
        data: { content: editContent },
      });
      toast.success('プロンプトを保存しました');
      setDialogOpen(false);
    } catch (err) {
      console.error('Failed to save prompt:', err);
      toast.error('プロンプトの保存に失敗しました');
    }
  };

  // ダイアログを閉じる
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedPrompt(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <CodeIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h5">プロンプト設定</Typography>
        {prompts && <Chip label={`${prompts.length}件`} size="small" variant="outlined" />}
      </Box>

      {/* 説明 */}
      <Alert severity="info" sx={{ mb: 3 }}>
        AI解析に使用するプロンプトを編集できます。変更は即座にファイルに保存されます。
      </Alert>

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          データの取得に失敗しました: {String(error)}
        </Alert>
      )}

      {/* ローディング */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : prompts && prompts.length > 0 ? (
        <Grid container spacing={2}>
          {prompts.map((prompt: PromptListItem) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={prompt.name}>
              <Card
                sx={{
                  height: '100%',
                  '&:hover': { boxShadow: 4 },
                }}
              >
                <CardActionArea
                  onClick={() => handleSelectPrompt(prompt.name)}
                  sx={{ height: '100%' }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CodeIcon color="primary" />
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {prompt.label}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {prompt.name}.txt
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {prompt.preview}
                    </Typography>
                    {prompt.updated_at && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 1, display: 'block' }}
                      >
                        更新: {new Date(prompt.updated_at).toLocaleString('ja-JP')}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CodeIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            プロンプトが見つかりません
          </Typography>
        </Box>
      )}

      {/* 編集ダイアログ */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          {selectedPrompt && promptDetail && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CodeIcon color="primary" />
              <Typography variant="h6">
                {promptDetail.label} ({selectedPrompt}.txt)
              </Typography>
            </Box>
          )}
        </DialogTitle>
        <DialogContent>
          {isLoadingDetail ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TextField
              fullWidth
              multiline
              minRows={20}
              maxRows={30}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              sx={{
                mt: 1,
                '& .MuiInputBase-root': {
                  fontFamily: 'monospace',
                  fontSize: '14px',
                },
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={isUpdating}>
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={isUpdating || isLoadingDetail}
          >
            {isUpdating ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
