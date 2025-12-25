/**
 * SpecNumberListPage - 摘番マスタ一覧ページ
 *
 * 摘番マスタの検索・一覧表示・CRUD操作
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  InputAdornment,
  Tooltip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import {
  useSpecNumbers,
  useCreateSpecNumber,
  useUpdateSpecNumber,
  useDeleteSpecNumber,
  useSpecNumberFilterOptions,
  useNextSpecNumber,
} from '../hooks/useSpecNumbers';
import { SpecNumberImportDialog } from '../components/SpecNumberImportDialog';
import type { SpecNumber, SpecNumberCreate, SpecNumberUpdate, SpecNumberListParams } from '../types/spec-number';

export const SpecNumberListPage = () => {
  // 検索パラメータ
  const [searchParams, setSearchParams] = useState<SpecNumberListParams>({
    page: 1,
    per_page: 25,
    sort_by: 'spec_number',
    sort_order: 'asc',
  });

  // 検索フィールド
  const [searchPrefix, setSearchPrefix] = useState('');
  const [searchSpecNumber, setSearchSpecNumber] = useState('');
  const [searchTitle, setSearchTitle] = useState('');
  const [searchLineName, setSearchLineName] = useState('');
  const [searchUsageLocation, setSearchUsageLocation] = useState('');

  // 新規作成時のプレフィックス選択
  const [selectedPrefix, setSelectedPrefix] = useState('A');

  // ダイアログ状態
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SpecNumber | null>(null);
  const [deletingItem, setDeletingItem] = useState<SpecNumber | null>(null);

  // フォームデータ
  const [formData, setFormData] = useState<SpecNumberCreate>({
    spec_number: '',
    title: '',
    model_name: '',
    material_code: '',
    usage_location: '',
    line_name: '',
    equipment_name: '',
    design_date: '',
    designer: '',
    reference_drawing: '',
    remarks: '',
  });

  // データ取得
  const { data, isLoading, error, refetch } = useSpecNumbers(searchParams);
  const { data: filterOptions } = useSpecNumberFilterOptions();
  const { data: nextSpecNumberData, isError: isNextSpecNumberError } = useNextSpecNumber(selectedPrefix);

  // ミューテーション
  const createMutation = useCreateSpecNumber();
  const updateMutation = useUpdateSpecNumber();
  const deleteMutation = useDeleteSpecNumber();

  // 検索実行
  const handleSearch = () => {
    setSearchParams((prev) => ({
      ...prev,
      page: 1,
      prefix: searchPrefix || undefined,
      spec_number: searchSpecNumber || undefined,
      title: searchTitle || undefined,
      line_name: searchLineName || undefined,
      usage_location: searchUsageLocation || undefined,
    }));
  };

  // 検索クリア
  const handleClearSearch = () => {
    setSearchPrefix('');
    setSearchSpecNumber('');
    setSearchTitle('');
    setSearchLineName('');
    setSearchUsageLocation('');
    setSearchParams((prev) => ({
      ...prev,
      page: 1,
      prefix: undefined,
      spec_number: undefined,
      title: undefined,
      line_name: undefined,
      usage_location: undefined,
    }));
  };

  // ページ変更
  const handlePageChange = (_: React.MouseEvent<HTMLButtonElement> | null, newPage: number) => {
    setSearchParams((prev) => ({ ...prev, page: newPage + 1 }));
  };

  // 1ページあたりの件数変更
  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchParams((prev) => ({
      ...prev,
      page: 1,
      per_page: parseInt(event.target.value, 10),
    }));
  };

  // 新規作成ダイアログを開く
  const handleOpenCreate = () => {
    setEditingItem(null);
    // 次の摘番をデフォルトで設定（エラー時は空）
    const defaultSpecNumber = isNextSpecNumberError ? '' : (nextSpecNumberData?.next_spec_number || '');
    setFormData({
      spec_number: defaultSpecNumber,
      title: '',
      model_name: '',
      material_code: '',
      usage_location: '',
      line_name: '',
      equipment_name: '',
      design_date: '',
      designer: '',
      reference_drawing: '',
      remarks: '',
    });
    setIsFormDialogOpen(true);
  };

  // プレフィックス変更時に摘番を更新
  const handlePrefixChange = (event: SelectChangeEvent<string>) => {
    const newPrefix = event.target.value;
    setSelectedPrefix(newPrefix);
  };

  // 次の摘番データが更新されたらフォームの摘番を更新（新規作成時のみ）
  useEffect(() => {
    if (!editingItem && isFormDialogOpen) {
      if (isNextSpecNumberError) {
        // エラー時（上限到達時）は空にする
        setFormData(prev => ({
          ...prev,
          spec_number: '',
        }));
      } else if (nextSpecNumberData) {
        setFormData(prev => ({
          ...prev,
          spec_number: nextSpecNumberData.next_spec_number,
        }));
      }
    }
  }, [nextSpecNumberData, isNextSpecNumberError, editingItem, isFormDialogOpen, selectedPrefix]);

  // 編集ダイアログを開く
  const handleOpenEdit = (item: SpecNumber) => {
    setEditingItem(item);
    setFormData({
      spec_number: item.spec_number,
      title: item.title || '',
      model_name: item.model_name || '',
      material_code: item.material_code || '',
      usage_location: item.usage_location || '',
      line_name: item.line_name || '',
      equipment_name: item.equipment_name || '',
      design_date: item.design_date || '',
      designer: item.designer || '',
      reference_drawing: item.reference_drawing || '',
      remarks: item.remarks || '',
    });
    setIsFormDialogOpen(true);
  };

  // 削除ダイアログを開く
  const handleOpenDelete = (item: SpecNumber) => {
    setDeletingItem(item);
    setIsDeleteDialogOpen(true);
  };

  // フォーム送信
  const handleFormSubmit = async () => {
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          data: formData as SpecNumberUpdate,
        });
      } else {
        await createMutation.mutateAsync(formData);
      }
      setIsFormDialogOpen(false);
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  // 削除実行
  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;

    try {
      await deleteMutation.mutateAsync(deletingItem.id);
      setIsDeleteDialogOpen(false);
      setDeletingItem(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // フォームフィールド変更
  const handleFormChange = (field: keyof SpecNumberCreate, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isFormSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  return (
    <Box sx={{ p: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          摘番マスタ
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => setIsImportDialogOpen(true)}
          >
            Excelインポート
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
          >
            新規追加
          </Button>
        </Box>
      </Box>

      {/* 検索フォーム */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>プレフィックス</InputLabel>
            <Select
              value={searchPrefix}
              label="プレフィックス"
              onChange={(e) => setSearchPrefix(e.target.value)}
            >
              <MenuItem value="">すべて</MenuItem>
              {filterOptions?.prefixes.map((prefix) => (
                <MenuItem key={prefix} value={prefix}>
                  {prefix}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="摘番"
            value={searchSpecNumber}
            onChange={(e) => setSearchSpecNumber(e.target.value)}
            size="small"
            sx={{ width: 150 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <TextField
            label="名称"
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            size="small"
            sx={{ width: 200 }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Autocomplete
            size="small"
            sx={{ width: 180 }}
            options={filterOptions?.line_names || []}
            value={searchLineName || null}
            onChange={(_, value) => setSearchLineName(value || '')}
            renderInput={(params) => (
              <TextField {...params} label="ライン" />
            )}
            freeSolo
          />
          <Autocomplete
            size="small"
            sx={{ width: 180 }}
            options={filterOptions?.usage_locations || []}
            value={searchUsageLocation || null}
            onChange={(_, value) => setSearchUsageLocation(value || '')}
            renderInput={(params) => (
              <TextField {...params} label="使用場所" />
            )}
            freeSolo
          />
          <Button variant="contained" onClick={handleSearch}>
            検索
          </Button>
          <Button variant="outlined" onClick={handleClearSearch} startIcon={<ClearIcon />}>
            クリア
          </Button>
          {data && (
            <Chip
              label={`${data.total.toLocaleString()} 件`}
              color="primary"
              variant="outlined"
              sx={{ ml: 'auto' }}
            />
          )}
        </Box>
      </Paper>

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          データの取得に失敗しました: {String(error)}
        </Alert>
      )}

      {/* テーブル */}
      <Paper>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 350px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: 100 }}>摘番</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 250 }}>名称</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 120 }}>型式</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 120 }}>材料コード</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 100 }}>使用場所</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 100 }}>ライン</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 100 }}>設備</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 80 }}>設計日</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 80 }}>設計者</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 100 }} align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : data?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      データがありません
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data?.items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {item.spec_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={item.title || ''} placement="top-start">
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 250,
                          }}
                        >
                          {item.title || '-'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{item.model_name || '-'}</TableCell>
                    <TableCell>{item.material_code || '-'}</TableCell>
                    <TableCell>{item.usage_location || '-'}</TableCell>
                    <TableCell>{item.line_name || '-'}</TableCell>
                    <TableCell>{item.equipment_name || '-'}</TableCell>
                    <TableCell>{item.design_date || '-'}</TableCell>
                    <TableCell>{item.designer || '-'}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="編集">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="削除">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleOpenDelete(item)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data?.total || 0}
          page={(searchParams.page || 1) - 1}
          onPageChange={handlePageChange}
          rowsPerPage={searchParams.per_page || 25}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="表示件数:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} / ${count.toLocaleString()} 件`
          }
        />
      </Paper>

      {/* 新規作成・編集ダイアログ */}
      <Dialog
        open={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingItem ? '摘番マスタ編集' : '摘番マスタ新規追加'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {!editingItem && (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>プレフィックス</InputLabel>
                  <Select
                    value={selectedPrefix}
                    label="プレフィックス"
                    onChange={handlePrefixChange}
                  >
                    {filterOptions?.prefixes.map((prefix) => (
                      <MenuItem key={prefix} value={prefix}>
                        {prefix} (次: {prefix === selectedPrefix
                          ? (isNextSpecNumberError ? '上限' : (nextSpecNumberData ? nextSpecNumberData.next_spec_number : '...'))
                          : '...'})
                      </MenuItem>
                    )) || (
                      <MenuItem value="A">A</MenuItem>
                    )}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6, md: editingItem ? 4 : 3 }}>
              <TextField
                label="摘番"
                value={formData.spec_number}
                onChange={(e) => handleFormChange('spec_number', e.target.value)}
                fullWidth
                required
                disabled={!!editingItem}
                error={!editingItem && isNextSpecNumberError}
                helperText={!editingItem
                  ? (isNextSpecNumberError ? `プレフィックス ${selectedPrefix} は上限（999）に達しています` : '自動で次の番号が設定されます')
                  : undefined}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: editingItem ? 8 : 6 }}>
              <TextField
                label="名称"
                value={formData.title}
                onChange={(e) => handleFormChange('title', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                label="型式"
                value={formData.model_name}
                onChange={(e) => handleFormChange('model_name', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                label="材料コード"
                value={formData.material_code}
                onChange={(e) => handleFormChange('material_code', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                label="使用場所"
                value={formData.usage_location}
                onChange={(e) => handleFormChange('usage_location', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                label="ライン"
                value={formData.line_name}
                onChange={(e) => handleFormChange('line_name', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                label="設備"
                value={formData.equipment_name}
                onChange={(e) => handleFormChange('equipment_name', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                label="設計日"
                value={formData.design_date}
                onChange={(e) => handleFormChange('design_date', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                label="設計者"
                value={formData.designer}
                onChange={(e) => handleFormChange('designer', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 8 }}>
              <TextField
                label="参照図面"
                value={formData.reference_drawing}
                onChange={(e) => handleFormChange('reference_drawing', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="備考"
                value={formData.remarks}
                onChange={(e) => handleFormChange('remarks', e.target.value)}
                fullWidth
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsFormDialogOpen(false)} disabled={isFormSubmitting}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleFormSubmit}
            disabled={isFormSubmitting || !formData.spec_number}
          >
            {isFormSubmitting ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
      >
        <DialogTitle>削除確認</DialogTitle>
        <DialogContent>
          <Typography>
            摘番「{deletingItem?.spec_number}」を削除しますか？
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            この操作は取り消せません。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? '削除中...' : '削除'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* インポートダイアログ */}
      <SpecNumberImportDialog
        open={isImportDialogOpen}
        onClose={() => {
          setIsImportDialogOpen(false);
          refetch();
        }}
      />
    </Box>
  );
};

export default SpecNumberListPage;
