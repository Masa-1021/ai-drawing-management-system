/**
 * 設備添付ファイル一覧・アップロードコンポーネント
 * - サブカテゴリ別グルーピング表示
 * - 更新ボタンによるバージョンアップ
 * - 旧バージョン履歴サイドバー
 */

import { useState, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemIcon,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Menu,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Description as FileIcon,
  Edit as EditIcon,
  Upgrade as UpdateIcon,
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import {
  useEquipmentAttachmentsGrouped,
  useUploadEquipmentAttachment,
  useDeleteEquipmentAttachment,
  useUpdateEquipmentAttachment,
  useUpdateAttachmentVersion,
  useAttachmentVersionHistory,
} from '../hooks/useEquipmentAttachments';
import { getAttachmentDownloadUrl } from '../api/equipment-attachments';
import type { AttachmentCategory, EquipmentAttachment } from '../types/equipment-attachment';
import { CATEGORY_LABELS, formatFileSize, SUB_CATEGORIES } from '../types/equipment-attachment';

interface EquipmentAttachmentListProps {
  equipmentId: string;
  category: AttachmentCategory;
}

export const EquipmentAttachmentList = ({ equipmentId, category }: EquipmentAttachmentListProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingAttachment, setEditingAttachment] = useState<EquipmentAttachment | null>(null);
  const [description, setDescription] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [selectedAttachmentForHistory, setSelectedAttachmentForHistory] = useState<string | null>(null);
  const [updatingAttachment, setUpdatingAttachment] = useState<EquipmentAttachment | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<EquipmentAttachment | null>(null);

  const { data, isLoading, error } = useEquipmentAttachmentsGrouped(equipmentId, category);
  const uploadMutation = useUploadEquipmentAttachment(equipmentId);
  const deleteMutation = useDeleteEquipmentAttachment(equipmentId);
  const updateMutation = useUpdateEquipmentAttachment(equipmentId);
  const updateVersionMutation = useUpdateAttachmentVersion(equipmentId);
  const { data: historyData } = useAttachmentVersionHistory(equipmentId, selectedAttachmentForHistory);

  const subCategories = SUB_CATEGORIES[category] || ['その他'];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadDialogOpen(true);
    }
    event.target.value = '';
  };

  const handleUpdateFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && updatingAttachment) {
      handleVersionUpdate(file);
    }
    event.target.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile || !subCategory) {
      toast.error('種別を選択してください');
      return;
    }

    try {
      await uploadMutation.mutateAsync({
        file: selectedFile,
        category,
        subCategory,
        description: description || undefined,
      });
      toast.success('ファイルをアップロードしました');
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setDescription('');
      setSubCategory('');
    } catch {
      toast.error('アップロードに失敗しました');
    }
  };

  const handleDelete = async (attachment: EquipmentAttachment) => {
    if (!confirm(`「${attachment.filename}」を削除しますか？`)) return;

    try {
      await deleteMutation.mutateAsync(attachment.id);
      toast.success('ファイルを削除しました');
    } catch {
      toast.error('削除に失敗しました');
    }
  };

  const handleDownload = (attachment: EquipmentAttachment) => {
    const url = getAttachmentDownloadUrl(equipmentId, attachment.id);
    window.open(url, '_blank');
  };

  const handleEditOpen = (attachment: EquipmentAttachment) => {
    setEditingAttachment(attachment);
    setDescription(attachment.description || '');
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingAttachment) return;

    try {
      await updateMutation.mutateAsync({
        attachmentId: editingAttachment.id,
        data: {
          description: description || undefined,
        },
      });
      toast.success('更新しました');
      setEditDialogOpen(false);
      setEditingAttachment(null);
    } catch {
      toast.error('更新に失敗しました');
    }
  };

  const handleUpdateClick = (attachment: EquipmentAttachment) => {
    setUpdatingAttachment(attachment);
    updateFileInputRef.current?.click();
  };

  const handleVersionUpdate = async (file: File) => {
    if (!updatingAttachment) return;

    try {
      await updateVersionMutation.mutateAsync({
        attachmentId: updatingAttachment.id,
        file,
      });
      toast.success(`バージョンアップしました`);
      setUpdatingAttachment(null);
    } catch {
      toast.error('バージョンアップに失敗しました');
    }
  };

  const handleHistoryOpen = (attachment: EquipmentAttachment) => {
    setSelectedAttachmentForHistory(attachment.id);
    setHistoryDrawerOpen(true);
  };

  const handleRowClick = (event: React.MouseEvent<HTMLTableRowElement>, attachment: EquipmentAttachment) => {
    setMenuAnchor(event.currentTarget);
    setSelectedAttachment(attachment);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedAttachment(null);
  };

  const handleMenuAction = (action: 'download' | 'update' | 'history' | 'edit' | 'delete') => {
    if (!selectedAttachment) return;

    switch (action) {
      case 'download':
        handleDownload(selectedAttachment);
        break;
      case 'update':
        handleUpdateClick(selectedAttachment);
        break;
      case 'history':
        handleHistoryOpen(selectedAttachment);
        break;
      case 'edit':
        handleEditOpen(selectedAttachment);
        break;
      case 'delete':
        handleDelete(selectedAttachment);
        break;
    }
    handleMenuClose();
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        データの取得に失敗しました
      </Alert>
    );
  }

  const groups = data?.groups || {};
  const totalItems = data?.total || 0;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1">
          {CATEGORY_LABELS[category]}（{totalItems}件）
        </Typography>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => fileInputRef.current?.click()}
          size="small"
        >
          新規アップロード
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <input
          type="file"
          ref={updateFileInputRef}
          onChange={handleUpdateFileSelect}
          style={{ display: 'none' }}
        />
      </Box>

      {/* ファイル一覧（サブカテゴリ別） */}
      {totalItems === 0 ? (
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            cursor: 'pointer',
            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Box textAlign="center">
            <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">
              ファイルをアップロードしてください
            </Typography>
            <Typography variant="caption" color="text.secondary">
              クリックしてファイルを選択
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          {Object.entries(groups).map(([subCat, attachments]) => (
            <Accordion key={subCat} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="medium">
                  {subCat}
                  <Chip label={attachments.length} size="small" sx={{ ml: 1 }} />
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ファイル名</TableCell>
                        <TableCell width={80}>Ver</TableCell>
                        <TableCell width={100}>サイズ</TableCell>
                        <TableCell>説明</TableCell>
                        <TableCell width={120}>登録日</TableCell>
                        <TableCell width={160} align="center">操作</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {attachments.map((attachment) => (
                        <TableRow
                          key={attachment.id}
                          hover
                          onClick={(e) => handleRowClick(e, attachment)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <FileIcon fontSize="small" color="action" />
                              <Typography variant="body2" noWrap>
                                {attachment.filename}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {attachment.version && (
                              <Chip
                                label={attachment.version}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatFileSize(attachment.file_size)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                              {attachment.description || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(attachment.created_at).toLocaleDateString('ja-JP')}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="caption" color="text.secondary">
                              クリックで操作
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* アップロードダイアログ */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>ファイルアップロード</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {selectedFile && (
              <Alert severity="info">
                選択ファイル: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </Alert>
            )}
            <FormControl fullWidth size="small" disabled>
              <InputLabel>カテゴリ</InputLabel>
              <Select value={category} label="カテゴリ">
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <MenuItem key={key} value={key}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" required>
              <InputLabel>種別</InputLabel>
              <Select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                label="種別"
              >
                {subCategories.map((sc) => (
                  <MenuItem key={sc} value={sc}>{sc}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="説明"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              size="small"
              multiline
              rows={2}
            />
            <Alert severity="info" sx={{ mt: 1 }}>
              バージョンは自動的に A, B, C... と採番されます
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>キャンセル</Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={!selectedFile || !subCategory || uploadMutation.isPending}
            startIcon={uploadMutation.isPending ? <CircularProgress size={16} /> : <UploadIcon />}
          >
            アップロード
          </Button>
        </DialogActions>
      </Dialog>

      {/* 編集ダイアログ */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>ファイル情報編集</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {editingAttachment && (
              <Alert severity="info">
                ファイル: {editingAttachment.filename}
              </Alert>
            )}
            <TextField
              label="説明"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              size="small"
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>キャンセル</Button>
          <Button
            onClick={handleEditSave}
            variant="contained"
            disabled={updateMutation.isPending}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* アクションメニュー */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'center', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <MenuItem onClick={() => handleMenuAction('download')}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="ダウンロード" secondary="ファイルをダウンロード" />
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('update')}>
          <ListItemIcon>
            <UpdateIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary="バージョンアップ" secondary="新しいファイルで更新" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleMenuAction('history')}>
          <ListItemIcon>
            <HistoryIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="バージョン履歴" secondary="過去のバージョンを確認" />
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('edit')}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="説明を編集" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleMenuAction('delete')} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary="削除" />
        </MenuItem>
      </Menu>

      {/* 旧バージョン履歴サイドバー */}
      <Drawer
        anchor="right"
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
      >
        <Box sx={{ width: 350, p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">バージョン履歴</Typography>
            <IconButton onClick={() => setHistoryDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {historyData && (
            <>
              {/* 現在のバージョン */}
              <Typography variant="subtitle2" color="primary" gutterBottom>
                現在のバージョン
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="body2" fontWeight="medium">
                  {historyData.current.filename}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <Chip label={`Ver ${historyData.current.version}`} size="small" color="primary" />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(historyData.current.created_at).toLocaleString('ja-JP')}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleDownload(historyData.current)}
                  sx={{ mt: 1 }}
                >
                  ダウンロード
                </Button>
              </Paper>

              {/* 旧バージョン */}
              {historyData.history.length > 0 && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    旧バージョン
                  </Typography>
                  <List dense>
                    {historyData.history.map((item) => (
                      <ListItem key={item.id} sx={{ bgcolor: 'grey.50', mb: 1, borderRadius: 1 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip label={`Ver ${item.version}`} size="small" variant="outlined" />
                              <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                                {item.filename}
                              </Typography>
                            </Box>
                          }
                          secondary={new Date(item.created_at).toLocaleString('ja-JP')}
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => handleDownload(item)}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {historyData.history.length === 0 && (
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  旧バージョンはありません
                </Typography>
              )}
            </>
          )}
        </Box>
      </Drawer>
    </Box>
  );
};
