/**
 * WebLinkDialog - Webリンク編集ダイアログ
 *
 * 購入品・部品タイプのアイテムに外部Webリンク（メーカーサイトなど）を設定するダイアログ
 * メーカー検索サイトへのクイックリンク機能付き
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
  Alert,
  Link,
  IconButton,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { MANUFACTURERS } from '../config/manufacturers';

interface WebLinkDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (webLink: string | null) => void;
  currentWebLink: string | null;
  itemName: string | null;
  isPending?: boolean;
}

export const WebLinkDialog = ({
  open,
  onClose,
  onSave,
  currentWebLink,
  itemName,
  isPending = false,
}: WebLinkDialogProps) => {
  const [webLink, setWebLink] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // ダイアログが開いたときに現在の値をセット
  useEffect(() => {
    if (open) {
      setWebLink(currentWebLink || '');
      setError(null);
    }
  }, [open, currentWebLink]);

  // URLバリデーション
  const validateUrl = (url: string): boolean => {
    if (!url || url.trim() === '') {
      return true; // 空は許可（削除）
    }
    return url.startsWith('http://') || url.startsWith('https://');
  };

  // 保存ハンドラ
  const handleSave = () => {
    const trimmedUrl = webLink.trim();

    if (trimmedUrl && !validateUrl(trimmedUrl)) {
      setError('URLはhttp://またはhttps://で始まる必要があります');
      return;
    }

    onSave(trimmedUrl || null);
  };

  // 削除ハンドラ
  const handleDelete = () => {
    setWebLink('');
    onSave(null);
  };

  // URL入力変更ハンドラ
  const handleUrlChange = (value: string) => {
    setWebLink(value);
    if (error && validateUrl(value)) {
      setError(null);
    }
  };

  // メーカーサイトを選択
  const handleManufacturerClick = (searchUrl: string) => {
    setWebLink(searchUrl);
    setError(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="h6">Webリンクを編集</Typography>
          {itemName && (
            <Typography variant="body2" color="text.secondary">
              {itemName}
            </Typography>
          )}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            メーカーサイトやカタログページなどの外部リンクを設定できます
          </Alert>

          {/* メーカークイックリンク */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              メーカー検索サイト
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {MANUFACTURERS.map((manufacturer) => (
                <Chip
                  key={manufacturer.id}
                  label={manufacturer.name}
                  size="small"
                  variant="outlined"
                  onClick={() => handleManufacturerClick(manufacturer.searchUrl)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'primary.light',
                      color: 'primary.contrastText',
                    },
                  }}
                />
              ))}
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <TextField
            fullWidth
            label="URL"
            placeholder="https://example.com/product/12345"
            value={webLink}
            onChange={(e) => handleUrlChange(e.target.value)}
            error={!!error}
            helperText={error || 'http:// または https:// で始まるURLを入力してください'}
            InputProps={{
              endAdornment: webLink && (
                <IconButton
                  size="small"
                  onClick={() => setWebLink('')}
                  edge="end"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              ),
            }}
          />

          {/* プレビュー */}
          {webLink && validateUrl(webLink) && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                プレビュー
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Link
                  href={webLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    maxWidth: '100%',
                    overflow: 'hidden',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {webLink}
                  </Typography>
                  <OpenInNewIcon fontSize="small" />
                </Link>
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        {currentWebLink && (
          <Button
            color="error"
            onClick={handleDelete}
            disabled={isPending}
            sx={{ mr: 'auto' }}
          >
            削除
          </Button>
        )}
        <Button onClick={onClose} disabled={isPending}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isPending || !!error}
          startIcon={isPending ? <CircularProgress size={16} /> : null}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};
