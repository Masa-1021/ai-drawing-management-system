/**
 * SpecSheetListPage - 摘要表一覧ページ
 *
 * 左ペイン: フィルタサイドバー
 * 右ペイン: 摘要表カード一覧
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Drawer,
  IconButton,
  Divider,
  Pagination,
  CircularProgress,
  Alert,
  InputAdornment,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon,
  Upload as UploadIcon,
  Description as DescriptionIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Clear as ClearIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useSpecSheets, useDeleteSpecSheet } from '../hooks/useSpecSheets';
import toast from 'react-hot-toast';
import { SpecSheetUploadDialog } from '../components/SpecSheetUploadDialog';
import { SpecNumberImportDialog } from '../components/SpecNumberImportDialog';
import type { SpecSheetStatus, SpecSheetListParams } from '../types/spec-sheet';

const DRAWER_WIDTH = 280;

export const SpecSheetListPage = () => {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // 選択・削除状態
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // フィルタ状態
  const [filters, setFilters] = useState<SpecSheetListParams>({
    page: 1,
    per_page: 12,
    sort_by: 'created_at',
    sort_order: 'desc',
  });

  // 検索クエリ（デバウンス用）
  const [searchInput, setSearchInput] = useState('');

  // データ取得
  const { data, isLoading, error, refetch } = useSpecSheets(filters);

  // 削除ミューテーション
  const { mutateAsync: deleteSpecSheet, isPending: isDeleting } = useDeleteSpecSheet();

  // 検索ハンドラ
  const handleSearch = () => {
    setFilters((prev) => ({
      ...prev,
      spec_number: searchInput || undefined,
      page: 1,
    }));
  };

  // フィルタ変更ハンドラ
  const handleFilterChange = (key: keyof SpecSheetListParams, value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1,
    }));
  };

  // フィルタクリア
  const handleClearFilters = () => {
    setFilters({
      page: 1,
      per_page: 12,
      sort_by: 'created_at',
      sort_order: 'desc',
    });
    setSearchInput('');
  };

  // ページ変更
  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  // ステータスに応じたチップを返す
  const getStatusChip = (status: SpecSheetStatus) => {
    switch (status) {
      case 'linked':
        return <Chip icon={<LinkIcon />} label="紐づけ済" size="small" color="success" />;
      case 'draft':
        return <Chip icon={<LinkOffIcon />} label="未紐づけ" size="small" color="warning" />;
      case 'active':
        return <Chip label="有効" size="small" color="primary" />;
      default:
        return null;
    }
  };

  // アクティブなフィルタ数
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.line_name) count++;
    if (filters.equipment_name) count++;
    if (filters.status) count++;
    if (filters.created_by) count++;
    return count;
  }, [filters]);

  // 選択ハンドラ
  const handleSelectItem = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  // 全選択/解除ハンドラ
  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.items) {
      setSelectedIds(new Set(data.items.map((item) => item.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 削除ハンドラ
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    try {
      // 選択された摘要表を削除
      await Promise.all(Array.from(selectedIds).map((id) => deleteSpecSheet(id)));
      toast.success(`${selectedIds.size}件の摘要表を削除しました`);
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      refetch();
    } catch (err) {
      console.error('Failed to delete spec sheets:', err);
      toast.error('摘要表の削除に失敗しました');
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {/* フィルタサイドバー */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            position: 'relative',
            height: '100%',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">フィルタ</Typography>
            {activeFilterCount > 0 && (
              <Button size="small" startIcon={<ClearIcon />} onClick={handleClearFilters}>
                クリア
              </Button>
            )}
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* ライン名フィルタ */}
          <TextField
            fullWidth
            label="ライン名"
            value={filters.line_name || ''}
            onChange={(e) => handleFilterChange('line_name', e.target.value)}
            size="small"
            sx={{ mb: 2 }}
          />

          {/* 設備名フィルタ */}
          <TextField
            fullWidth
            label="設備名"
            value={filters.equipment_name || ''}
            onChange={(e) => handleFilterChange('equipment_name', e.target.value)}
            size="small"
            sx={{ mb: 2 }}
          />

          {/* ステータスフィルタ */}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>ステータス</InputLabel>
            <Select
              value={filters.status || ''}
              label="ステータス"
              onChange={(e) => handleFilterChange('status', e.target.value as SpecSheetStatus)}
            >
              <MenuItem value="">すべて</MenuItem>
              <MenuItem value="linked">紐づけ済</MenuItem>
              <MenuItem value="draft">未紐づけ</MenuItem>
              <MenuItem value="archived">アーカイブ</MenuItem>
            </Select>
          </FormControl>

          {/* 作成者フィルタ */}
          <TextField
            fullWidth
            label="作成者"
            value={filters.created_by || ''}
            onChange={(e) => handleFilterChange('created_by', e.target.value)}
            size="small"
            sx={{ mb: 2 }}
          />

          <Divider sx={{ my: 2 }} />

          {/* ソート */}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>並び順</InputLabel>
            <Select
              value={`${filters.sort_by}-${filters.sort_order}`}
              label="並び順"
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-');
                setFilters((prev) => ({
                  ...prev,
                  sort_by: sortBy,
                  sort_order: sortOrder as 'asc' | 'desc',
                }));
              }}
            >
              <MenuItem value="created_at-desc">登録日（新しい順）</MenuItem>
              <MenuItem value="created_at-asc">登録日（古い順）</MenuItem>
              <MenuItem value="spec_number-asc">摘番（昇順）</MenuItem>
              <MenuItem value="spec_number-desc">摘番（降順）</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Drawer>

      {/* メインコンテンツ */}
      <Box sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
        {/* ヘッダー */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={() => setDrawerOpen(!drawerOpen)}>
              <FilterListIcon />
            </IconButton>
            <Typography variant="h5">摘要表一覧</Typography>
            {data && (
              <Chip label={`${data.total}件`} size="small" variant="outlined" />
            )}
            {/* 全選択チェックボックス */}
            {data && data.items.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                <Checkbox
                  checked={selectedIds.size === data.items.length && data.items.length > 0}
                  indeterminate={selectedIds.size > 0 && selectedIds.size < data.items.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  size="small"
                />
                <Typography variant="body2" color="text.secondary">
                  すべて選択
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {/* 削除ボタン */}
            {selectedIds.size > 0 && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteDialogOpen(true)}
              >
                選択を削除 ({selectedIds.size})
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => setImportDialogOpen(true)}
            >
              摘番マスタインポート
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              摘要表アップロード
            </Button>
          </Box>
        </Box>

        {/* 検索バー */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="摘番で検索（例: S843）"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchInput && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => { setSearchInput(''); handleFilterChange('spec_number', ''); }}>
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

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
        ) : data && data.items.length > 0 ? (
          <>
            {/* カードグリッド */}
            <Grid container spacing={2}>
              {data.items.map((specSheet) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={specSheet.id}>
                  <Card
                    sx={{
                      height: '100%',
                      position: 'relative',
                      '&:hover': {
                        boxShadow: 4,
                      },
                    }}
                  >
                    {/* チェックボックス */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        zIndex: 1,
                      }}
                    >
                      <Checkbox
                        checked={selectedIds.has(specSheet.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectItem(specSheet.id, e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        size="small"
                      />
                    </Box>
                    <CardActionArea
                      onClick={() => navigate(`/spec-sheets/${specSheet.id}`)}
                      sx={{ height: '100%' }}
                    >
                      <CardContent sx={{ pl: 5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                          <DescriptionIcon color="primary" />
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {specSheet.spec_number}
                          </Typography>
                        </Box>

                        {specSheet.equipment_name && (
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {specSheet.line_name && `${specSheet.line_name} > `}
                            {specSheet.equipment_name}
                          </Typography>
                        )}

                        {specSheet.model_name && (
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
                            型式: {specSheet.model_name}
                          </Typography>
                        )}

                        <Box sx={{ mt: 1.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {getStatusChip(specSheet.status)}
                          {specSheet.current_revision && (
                            <Chip
                              label={`Rev.${specSheet.current_revision}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>

                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 1 }}
                        >
                          {new Date(specSheet.created_at).toLocaleDateString('ja-JP')}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* ページネーション */}
            {data.total > (filters.per_page || 12) && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination
                  count={Math.ceil(data.total / (filters.per_page || 12))}
                  page={filters.page || 1}
                  onChange={handlePageChange}
                  color="primary"
                />
              </Box>
            )}
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <DescriptionIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              摘要表がありません
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              「摘要表アップロード」ボタンからExcelファイルをアップロードしてください
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              摘要表アップロード
            </Button>
          </Box>
        )}
      </Box>

      {/* アップロードダイアログ */}
      <SpecSheetUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* 摘番マスタインポートダイアログ */}
      <SpecNumberImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onSuccess={() => {}}
      />

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>摘要表削除の確認</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {selectedIds.size}件の摘要表を削除してもよろしいですか？
            <br />
            紐づいている図面との関連も解除されます。この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
            キャンセル
          </Button>
          <Button
            onClick={handleDeleteSelected}
            color="error"
            variant="contained"
            disabled={isDeleting}
          >
            {isDeleting ? '削除中...' : '削除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
