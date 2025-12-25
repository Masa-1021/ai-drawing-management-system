/**
 * SpecSheetDetailPage - 摘要表詳細ページ
 *
 * 摘要表の詳細情報、部品リスト（DataGrid with フィルタ）、図面紐づけ管理
 */

import { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Checkbox,
  Badge,
  Menu,
  MenuItem,
  Select,
  FormControl,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbarContainer,
  GridToolbarFilterButton,
  GridToolbarExport,
  GridToolbarQuickFilter,
  GridApi,
  GridRowSelectionModel,
} from '@mui/x-data-grid';
import { jaJP } from '@mui/x-data-grid/locales';
import {
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Image as ImageIcon,
  CheckCircle as CheckCircleIcon,
  AccountTree as AccountTreeIcon,
  History as HistoryIcon,
  AutoFixHigh as AutoFixHighIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  OpenInNew as OpenInNewIcon,
  FormatListBulleted as FormatListBulletedIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useSpecSheet, useMatchingDrawings, useLinkDrawingsToSpecSheet, useLinkSpecSheetToEquipment, useUpdateItemParent, useBulkUpdatePartType, useLinkDrawingToItem, useUnlinkDrawingFromItem, useUpdateItemWebLink, useDeleteSpecSheet } from '../hooks/useSpecSheets';
import { EquipmentSelectDialog } from '../components/EquipmentSelectDialog';
import { DrawingSelectDialog } from '../components/DrawingSelectDialog';
import { DrawingTreeTab } from '../components/DrawingTreeTab';
import { WebLinkDialog } from '../components/WebLinkDialog';
import toast from 'react-hot-toast';
import type { SpecSheetItem, PartType } from '../types/spec-sheet';
import type { Drawing } from '../types/drawing';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = ({ children, value, index }: TabPanelProps) => (
  <div hidden={value !== index} style={{ height: '100%', overflow: 'auto' }}>
    {value === index && <Box sx={{ pt: 2, height: '100%' }}>{children}</Box>}
  </div>
);

// 部品タイプに応じたチップを返す（全て白背景）
const getPartTypeChip = (partType: string) => {
  const label = getPartTypeLabel(partType);
  return <Chip label={label} size="small" variant="outlined" />;
};

// 部品タイプ文字列を返す（フィルタ用）
const getPartTypeLabel = (partType: string): string => {
  switch (partType) {
    case 'assembly':
      return '組図';
    case 'unit':
      return 'ユニット';
    case 'part':
      return '部品';
    case 'purchased':
      return '購入品';
    default:
      return partType;
  }
};

// 部品種別オプション
const partTypeOptions: { value: PartType; label: string }[] = [
  { value: 'assembly', label: '組図' },
  { value: 'unit', label: 'ユニット' },
  { value: 'part', label: '部品' },
  { value: 'purchased', label: '購入品' },
];

// カスタムツールバー（シンプル版）
const SimpleToolbar = () => {
  return (
    <GridToolbarContainer sx={{ p: 1, gap: 1 }}>
      <GridToolbarFilterButton />
      <GridToolbarExport />
      <Box sx={{ flexGrow: 1 }} />
      <GridToolbarQuickFilter placeholder="検索..." />
    </GridToolbarContainer>
  );
};

export const SpecSheetDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<Record<string, boolean>>({});

  // 削除ダイアログ状態
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // 編集モード状態
  const [isEditMode, setIsEditMode] = useState(false);

  // 一括変更メニュー用の状態
  const [bulkMenuAnchor, setBulkMenuAnchor] = useState<null | HTMLElement>(null);

  // 親選択用の状態
  const [parentSelectAnchor, setParentSelectAnchor] = useState<null | HTMLElement>(null);
  const [parentSelectItemId, setParentSelectItemId] = useState<string | null>(null);

  // 図面選択ダイアログ用の状態
  const [drawingSelectDialogOpen, setDrawingSelectDialogOpen] = useState(false);
  const [selectedItemForDrawing, setSelectedItemForDrawing] = useState<SpecSheetItem | null>(null);

  // Webリンクダイアログ用の状態
  const [webLinkDialogOpen, setWebLinkDialogOpen] = useState(false);
  const [selectedItemForWebLink, setSelectedItemForWebLink] = useState<SpecSheetItem | null>(null);

  // DataGridの行選択状態
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() });

  // DataGrid APIへの参照
  const dataGridApiRef = useRef<GridApi | null>(null);

  // データ取得
  const { data: specSheet, isLoading, error, refetch } = useSpecSheet(id || '');
  const { data: matchingDrawings, isLoading: isLoadingMatching } = useMatchingDrawings(
    id || '',
    linkDialogOpen
  );

  // ミューテーション
  const { mutate: linkToEquipment } = useLinkSpecSheetToEquipment();
  const { mutate: linkDrawings, isPending: isLinkingDrawings } = useLinkDrawingsToSpecSheet();
  const { mutate: updateParent } = useUpdateItemParent();
  const { mutate: bulkUpdateType, isPending: isUpdatingPartType } = useBulkUpdatePartType();
  const { mutate: linkSingleDrawing } = useLinkDrawingToItem();
  const { mutate: unlinkDrawing, isPending: isUnlinkingDrawing } = useUnlinkDrawingFromItem();
  const { mutate: updateWebLink, isPending: isUpdatingWebLink } = useUpdateItemWebLink();
  const { mutate: deleteSpecSheet, isPending: isDeleting } = useDeleteSpecSheet();

  // 摘要表削除ハンドラ
  const handleDelete = () => {
    if (!id) return;
    deleteSpecSheet(id, {
      onSuccess: () => {
        toast.success('摘要表を削除しました');
        navigate('/spec-sheets');
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : '削除に失敗しました';
        toast.error(message);
      },
    });
    setDeleteDialogOpen(false);
  };

  // 設備紐づけハンドラ
  const handleEquipmentSelect = (equipmentId: string) => {
    if (!id) return;
    linkToEquipment(
      { specSheetId: id, request: { equipment_id: equipmentId } },
      { onSuccess: () => refetch() }
    );
  };

  // 選択行数を取得（DataGrid v8では { type, ids: Set } 形式）
  const selectedRowCount = rowSelectionModel?.ids?.size ?? 0;

  // 種別一括更新ハンドラ
  const handleBulkUpdatePartType = (partType: PartType) => {
    if (!id || rowSelectionModel.ids.size === 0) return;

    const itemIds = Array.from(rowSelectionModel.ids).map((rowId) => String(rowId));

    bulkUpdateType(
      {
        specSheetId: id,
        request: { item_ids: itemIds, part_type: partType },
      },
      {
        onSuccess: (result) => {
          toast.success(`${result.updated_count}件の種別を更新しました`);
          setRowSelectionModel({ type: 'include', ids: new Set() });
          refetch();
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : '種別の更新に失敗しました';
          toast.error(message);
        },
      }
    );
  };

  // 候補の配列を取得
  const candidates = matchingDrawings?.candidates || [];

  // 図面紐づけハンドラ
  const handleLinkDrawings = () => {
    if (!id || candidates.length === 0) return;

    const links = candidates
      .filter((m) => selectedLinks[m.spec_sheet_item_id])
      .map((m) => ({
        spec_sheet_item_id: m.spec_sheet_item_id,
        drawing_id: m.drawing_id,
      }));

    if (links.length === 0) return;

    linkDrawings(
      { specSheetId: id, request: { links } },
      {
        onSuccess: () => {
          setLinkDialogOpen(false);
          setSelectedLinks({});
          refetch();
        },
      }
    );
  };

  // 全選択/解除
  const handleSelectAll = () => {
    if (candidates.length === 0) return;
    const allSelected = candidates.every((m) => selectedLinks[m.spec_sheet_item_id]);
    if (allSelected) {
      setSelectedLinks({});
    } else {
      const newSelected: Record<string, boolean> = {};
      candidates.forEach((m) => {
        newSelected[m.spec_sheet_item_id] = true;
      });
      setSelectedLinks(newSelected);
    }
  };

  // 品名が空でない行のみフィルタ + 親候補リストを作成
  const { filteredItems, parentCandidates, itemsById } = useMemo(() => {
    const items = specSheet?.items || [];
    const filtered = items.filter((item) => item.part_name && item.part_name.trim() !== '');

    // IDからアイテムへのマップ
    const byId = new Map<string, SpecSheetItem>();
    filtered.forEach((item) => byId.set(item.id, item));

    // 親候補：組図とユニット図
    const parents = filtered.filter((item) =>
      item.part_type === 'assembly' || item.part_type === 'unit'
    );

    return { filteredItems: filtered, parentCandidates: parents, itemsById: byId };
  }, [specSheet?.items]);

  // 親図面の行にスクロール
  const scrollToParent = (parentItemId: string) => {
    const rowIndex = filteredItems.findIndex((item) => item.id === parentItemId);
    if (rowIndex !== -1 && dataGridApiRef.current) {
      dataGridApiRef.current.scrollToIndexes({ rowIndex });
      // 行をハイライト（一時的に選択）
      dataGridApiRef.current.selectRow(parentItemId, true, true);
      setTimeout(() => {
        dataGridApiRef.current?.selectRow(parentItemId, false, true);
      }, 2000);
    }
  };

  // 親選択メニューを開く
  const handleOpenParentSelect = (event: React.MouseEvent<HTMLElement>, itemId: string) => {
    setParentSelectAnchor(event.currentTarget);
    setParentSelectItemId(itemId);
  };

  // 親選択メニューを閉じる
  const handleCloseParentSelect = () => {
    setParentSelectAnchor(null);
    setParentSelectItemId(null);
  };

  // 親を選択してAPIで更新
  const handleSelectParent = (parentId: string) => {
    if (!id || !parentSelectItemId) return;

    updateParent(
      {
        specSheetId: id,
        itemId: parentSelectItemId,
        request: { parent_item_id: parentId },
      },
      {
        onSuccess: () => {
          toast.success('親図面を更新しました');
          handleCloseParentSelect();
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : '親図面の更新に失敗しました';
          toast.error(message);
        },
      }
    );
  };

  // 図面選択ダイアログを開く
  const handleOpenDrawingSelectDialog = (item: SpecSheetItem) => {
    setSelectedItemForDrawing(item);
    setDrawingSelectDialogOpen(true);
  };

  // 図面を選択して紐づける
  const handleDrawingSelect = (drawing: Drawing) => {
    if (!id || !selectedItemForDrawing) return;

    linkSingleDrawing(
      {
        specSheetId: id,
        itemId: selectedItemForDrawing.id,
        request: { drawing_id: drawing.id },
      },
      {
        onSuccess: () => {
          toast.success('図面を紐づけました');
          setDrawingSelectDialogOpen(false);
          setSelectedItemForDrawing(null);
          refetch();
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : '図面の紐づけに失敗しました';
          toast.error(message);
        },
      }
    );
  };

  // 図面の紐づけを解除
  const handleUnlinkDrawing = (item: SpecSheetItem) => {
    if (!id || !item.linked_drawing_id) return;

    unlinkDrawing(
      {
        specSheetId: id,
        itemId: item.id,
      },
      {
        onSuccess: () => {
          toast.success('図面の紐づけを解除しました');
          refetch();
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : '紐づけ解除に失敗しました';
          toast.error(message);
        },
      }
    );
  };

  // Webリンクダイアログを開く
  const handleOpenWebLinkDialog = (item: SpecSheetItem) => {
    setSelectedItemForWebLink(item);
    setWebLinkDialogOpen(true);
  };

  // Webリンクを保存
  const handleSaveWebLink = (webLink: string | null) => {
    if (!id || !selectedItemForWebLink) return;

    updateWebLink(
      {
        specSheetId: id,
        itemId: selectedItemForWebLink.id,
        request: { web_link: webLink },
      },
      {
        onSuccess: () => {
          toast.success(webLink ? 'Webリンクを保存しました' : 'Webリンクを削除しました');
          setWebLinkDialogOpen(false);
          setSelectedItemForWebLink(null);
          refetch();
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'Webリンクの保存に失敗しました';
          toast.error(message);
        },
      }
    );
  };

  // 現在選択中のアイテムの親候補を取得
  const currentItemParentCandidates = useMemo(() => {
    if (!parentSelectItemId) return [];
    const item = itemsById.get(parentSelectItemId);
    if (!item) return [];

    // ユニット図の親候補は組図のみ
    if (item.part_type === 'unit') {
      return parentCandidates.filter((p) => p.part_type === 'assembly');
    }
    // 部品図・購入品の親候補はユニット図と組図
    if (item.part_type === 'part' || item.part_type === 'purchased') {
      return parentCandidates.filter((p) =>
        p.part_type === 'assembly' || p.part_type === 'unit'
      );
    }
    return [];
  }, [parentSelectItemId, parentCandidates, itemsById]);

  // DataGrid用のカラム定義
  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'row_number',
      headerName: 'No.',
      width: 60,
      type: 'number',
    },
    {
      field: 'part_type',
      headerName: '種別',
      width: isEditMode ? 130 : 100,
      valueGetter: (value: string) => getPartTypeLabel(value),
      renderCell: (params: GridRenderCellParams<SpecSheetItem>) => {
        const item = params.row;
        if (isEditMode) {
          // 編集モード: ドロップダウンで選択
          return (
            <FormControl size="small" fullWidth>
              <Select
                value={item.part_type}
                onChange={(e) => {
                  const newPartType = e.target.value as PartType;
                  if (id && newPartType !== item.part_type) {
                    bulkUpdateType(
                      {
                        specSheetId: id,
                        request: { item_ids: [item.id], part_type: newPartType },
                      },
                      {
                        onSuccess: () => {
                          toast.success('種別を更新しました');
                          refetch();
                        },
                        onError: (error) => {
                          const message = error instanceof Error ? error.message : '種別の更新に失敗しました';
                          toast.error(message);
                        },
                      }
                    );
                  }
                }}
                sx={{ fontSize: '0.875rem' }}
              >
                {partTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        }
        // 閲覧モード: チップ表示
        return getPartTypeChip(item.part_type);
      },
    },
    {
      field: 'part_name',
      headerName: '品名',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'drawing_number',
      headerName: '図番',
      width: 140,
    },
    {
      field: 'parent_name',
      headerName: '親図面',
      width: 180,
      description: 'ユニット図の親は組図、部品図の親はユニット図または組図',
      renderCell: (params: GridRenderCellParams<SpecSheetItem>) => {
        const item = params.row;

        // 組図の場合は親なし（空白）
        if (item.part_type === 'assembly') {
          return null;
        }

        // 親が特定できている場合（parent_item_idがある）
        if (item.parent_item_id) {
          const parentItem = itemsById.get(item.parent_item_id);
          if (parentItem) {
            return (
              <Link
                component="button"
                variant="body2"
                onClick={() => scrollToParent(item.parent_item_id!)}
                sx={{ textAlign: 'left' }}
              >
                {parentItem.part_name || parentItem.drawing_number || `No.${parentItem.row_number}`}
              </Link>
            );
          }
        }

        // parent_nameがある場合は表示（リンクなし）
        if (item.parent_name) {
          return (
            <Typography variant="body2" color="text.secondary">
              {item.parent_name}
            </Typography>
          );
        }

        // 親が特定できていない場合は選択ボタン（編集モードのみ）
        if (isEditMode) {
          return (
            <Tooltip title="親図面を選択">
              <IconButton
                size="small"
                onClick={(e) => handleOpenParentSelect(e, item.id)}
              >
                <EditIcon fontSize="small" color="action" />
              </IconButton>
            </Tooltip>
          );
        }
        return null;
      },
    },
    {
      field: 'material',
      headerName: '材質',
      width: 100,
    },
    {
      field: 'quantity_per_set',
      headerName: '数量',
      width: 70,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'linked_drawing_id',
      headerName: '図面',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<SpecSheetItem>) => {
        const item = params.row;
        if (item.linked_drawing_id) {
          // 紐づけ済み: 確認ボタン + 解除ボタン（解除は編集モードのみ）
          return (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Tooltip title="図面を確認">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => navigate(`/edit/${item.linked_drawing_id}`)}
                >
                  <CheckCircleIcon />
                </IconButton>
              </Tooltip>
              {isEditMode && (
                <Tooltip title="紐づけを解除">
                  <IconButton
                    size="small"
                    color="default"
                    onClick={() => handleUnlinkDrawing(item)}
                    disabled={isUnlinkingDrawing}
                  >
                    <LinkOffIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          );
        }
        // 未紐づけ: 図面選択ボタン（編集モードのみ）
        if (!isEditMode) return null;
        return (
          <Tooltip title="図面を選択して紐づける">
            <IconButton
              size="small"
              color="default"
              onClick={() => handleOpenDrawingSelectDialog(item)}
            >
              <LinkIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        );
      },
    },
    {
      field: 'web_link',
      headerName: 'Webリンク',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<SpecSheetItem>) => {
        const item = params.row;
        // 部品・購入品タイプ以外は表示しない
        if (item.part_type !== 'part' && item.part_type !== 'purchased') {
          return null;
        }

        if (item.web_link) {
          // Webリンクあり: 外部リンクアイコン + 編集ボタン（編集モードのみ）
          return (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Tooltip title="Webリンクを開く">
                <IconButton
                  size="small"
                  color="primary"
                  href={item.web_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  component="a"
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {isEditMode && (
                <Tooltip title="Webリンクを編集">
                  <IconButton
                    size="small"
                    color="default"
                    onClick={() => handleOpenWebLinkDialog(item)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          );
        }

        // Webリンクなし: 追加ボタン（編集モードのみ）
        if (!isEditMode) return null;
        return (
          <Tooltip title="Webリンクを追加">
            <IconButton
              size="small"
              color="default"
              onClick={() => handleOpenWebLinkDialog(item)}
            >
              <LinkIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        );
      },
    },
  ], [navigate, itemsById, isUnlinkingDrawing, isEditMode, id, bulkUpdateType, refetch, handleOpenWebLinkDialog]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !specSheet) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          摘要表の取得に失敗しました: {String(error || '不明なエラー')}
        </Alert>
        <Button
          onClick={() => navigate('/spec-sheets')}
          sx={{ mt: 2 }}
        >
          一覧に戻る
        </Button>
      </Box>
    );
  }

  const selectedCount = Object.values(selectedLinks).filter(Boolean).length;

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* パンくずリスト */}
      <Breadcrumbs sx={{ mb: 2, flexShrink: 0 }}>
        <Link component={RouterLink} to="/spec-sheets" underline="hover" color="inherit">
          摘要表一覧
        </Link>
        <Typography color="text.primary">{specSheet.spec_number}</Typography>
      </Breadcrumbs>

      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexShrink: 0 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="h5">{specSheet.spec_number}</Typography>
            <Tooltip title="クリックして設備を変更">
              {specSheet.status === 'linked' ? (
                <Chip
                  icon={<LinkIcon />}
                  label="紐づけ済"
                  color="success"
                  size="small"
                  onClick={() => setEquipmentDialogOpen(true)}
                  sx={{ cursor: 'pointer' }}
                />
              ) : (
                <Chip
                  icon={<LinkOffIcon />}
                  label="未紐づけ"
                  color="warning"
                  size="small"
                  onClick={() => setEquipmentDialogOpen(true)}
                  sx={{ cursor: 'pointer' }}
                />
              )}
            </Tooltip>
            {specSheet.current_revision && (
              <Chip label={`Rev.${specSheet.current_revision}`} variant="outlined" size="small" />
            )}
          </Box>
          {specSheet.equipment_name && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              onClick={() => setEquipmentDialogOpen(true)}
            >
              {specSheet.line_name && `${specSheet.line_name} > `}
              {specSheet.equipment_name}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* 編集モード/閲覧モード切り替え */}
          <ToggleButtonGroup
            value={isEditMode ? 'edit' : 'view'}
            exclusive
            onChange={(_, newValue) => {
              if (newValue !== null) {
                setIsEditMode(newValue === 'edit');
              }
            }}
            size="small"
          >
            <ToggleButton value="view">
              <Tooltip title="閲覧モード">
                <VisibilityIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="edit">
              <Tooltip title="編集モード">
                <EditIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          {isEditMode && (
            <>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteDialogOpen(true)}
              >
                削除
              </Button>
              <Badge badgeContent={candidates.length || 0} color="primary">
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AutoFixHighIcon />}
                  onClick={() => setLinkDialogOpen(true)}
                >
                  図面自動紐づけ
                </Button>
              </Badge>
            </>
          )}
        </Box>
      </Box>

      {/* メタ情報 */}
      <Paper sx={{ p: 1.5, mb: 2, flexShrink: 0 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">型式</Typography>
            <Typography variant="body2">{specSheet.model_name || '-'}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">注番</Typography>
            <Typography variant="body2">{specSheet.order_number || '-'}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">作成者</Typography>
            <Typography variant="body2">{specSheet.created_by || '-'}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">登録日</Typography>
            <Typography variant="body2">
              {new Date(specSheet.created_at).toLocaleDateString('ja-JP')}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* タブ */}
      <Paper sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}>
          <Tab icon={<FormatListBulletedIcon />} iconPosition="start" label="部品・図面一覧" sx={{ minHeight: 48 }} />
          <Tab icon={<AccountTreeIcon />} iconPosition="start" label="図面ツリー" sx={{ minHeight: 48 }} />
          <Tab icon={<HistoryIcon />} iconPosition="start" label="改定履歴" sx={{ minHeight: 48 }} />
        </Tabs>

        {/* 部品・図面一覧タブ */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 選択時のアクションバー（DataGridの外に配置） */}
            {isEditMode && selectedRowCount > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, mb: 1 }}>
                <Chip
                  label={`${selectedRowCount}件選択中`}
                  size="small"
                  color="primary"
                />
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={(e) => setBulkMenuAnchor(e.currentTarget)}
                  disabled={isUpdatingPartType}
                  startIcon={isUpdatingPartType ? <CircularProgress size={16} color="inherit" /> : null}
                >
                  種別を一括変更
                </Button>
                <Menu
                  anchorEl={bulkMenuAnchor}
                  open={Boolean(bulkMenuAnchor)}
                  onClose={() => setBulkMenuAnchor(null)}
                >
                  {partTypeOptions.map((option) => (
                    <MenuItem
                      key={option.value}
                      onClick={() => {
                        handleBulkUpdatePartType(option.value);
                        setBulkMenuAnchor(null);
                      }}
                    >
                      {option.label}
                    </MenuItem>
                  ))}
                </Menu>
              </Box>
            )}
            <DataGrid
              rows={filteredItems}
              columns={columns}
              density="compact"
              checkboxSelection={isEditMode}
              rowSelectionModel={rowSelectionModel}
              onRowSelectionModelChange={setRowSelectionModel}
              localeText={jaJP.components.MuiDataGrid.defaultProps.localeText}
              slots={{
                toolbar: SimpleToolbar,
              }}
              initialState={{
                sorting: {
                  sortModel: [{ field: 'row_number', sort: 'asc' }],
                },
              }}
              apiRef={dataGridApiRef as React.MutableRefObject<GridApi>}
              sx={{
                '& .MuiDataGrid-cell': {
                  py: 0.5,
                },
                '& .MuiDataGrid-columnHeaderTitle': {
                  fontWeight: 'bold',
                },
              }}
            />
          </Box>
        </TabPanel>

        {/* 図面ツリータブ */}
        <TabPanel value={tabValue} index={1}>
          <DrawingTreeTab items={filteredItems} />
        </TabPanel>

        {/* 改定履歴タブ */}
        <TabPanel value={tabValue} index={2}>
          <TableContainer sx={{ height: '100%' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={80}>改定記号</TableCell>
                  <TableCell width={120}>改定日</TableCell>
                  <TableCell>改定内容</TableCell>
                  <TableCell width={100}>作成</TableCell>
                  <TableCell width={100}>検図</TableCell>
                  <TableCell width={100}>承認</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {specSheet.revisions && specSheet.revisions.length > 0 ? (
                  specSheet.revisions.map((rev) => (
                    <TableRow key={rev.id} hover>
                      <TableCell>
                        <Chip label={rev.revision_symbol} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{rev.revision_date || '-'}</TableCell>
                      <TableCell>{rev.description || '-'}</TableCell>
                      <TableCell>{rev.created_by || '-'}</TableCell>
                      <TableCell>{rev.checked_by || '-'}</TableCell>
                      <TableCell>{rev.approved_by || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary" sx={{ py: 4 }}>
                        改定履歴がありません
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>

      {/* 親選択メニュー */}
      <Menu
        anchorEl={parentSelectAnchor}
        open={Boolean(parentSelectAnchor)}
        onClose={handleCloseParentSelect}
        PaperProps={{
          sx: { maxHeight: 300, width: 280 },
        }}
      >
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">
            親図面を選択
          </Typography>
        </MenuItem>
        {currentItemParentCandidates.length > 0 ? (
          currentItemParentCandidates.map((parent) => (
            <MenuItem
              key={parent.id}
              onClick={() => handleSelectParent(parent.id)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label={getPartTypeLabel(parent.part_type)} size="small" variant="outlined" />
                <Typography variant="body2" noWrap>
                  {parent.part_name || parent.drawing_number}
                </Typography>
              </Box>
            </MenuItem>
          ))
        ) : (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              候補がありません
            </Typography>
          </MenuItem>
        )}
      </Menu>

      {/* 設備選択ダイアログ */}
      <EquipmentSelectDialog
        open={equipmentDialogOpen}
        onClose={() => setEquipmentDialogOpen(false)}
        onSelect={handleEquipmentSelect}
        currentEquipmentId={specSheet.equipment_id || undefined}
      />

      {/* 図面紐づけダイアログ */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">図面自動紐づけ</Typography>
            {candidates.length > 0 && (
              <Button size="small" onClick={handleSelectAll}>
                {candidates.every((m) => selectedLinks[m.spec_sheet_item_id])
                  ? '全解除'
                  : '全選択'}
              </Button>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {isLoadingMatching ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : candidates.length > 0 ? (
            <List>
              {candidates.map((match) => (
                <ListItem
                  key={match.spec_sheet_item_id}
                  secondaryAction={
                    <Checkbox
                      checked={selectedLinks[match.spec_sheet_item_id] || false}
                      onChange={(e) =>
                        setSelectedLinks((prev) => ({
                          ...prev,
                          [match.spec_sheet_item_id]: e.target.checked,
                        }))
                      }
                    />
                  }
                >
                  <ListItemAvatar>
                    {match.drawing_thumbnail ? (
                      <Avatar
                        variant="rounded"
                        src={`/storage/${match.drawing_thumbnail}`}
                        sx={{ width: 56, height: 56 }}
                      />
                    ) : (
                      <Avatar variant="rounded" sx={{ width: 56, height: 56 }}>
                        <ImageIcon />
                      </Avatar>
                    )}
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1">
                          {match.spec_sheet_item_name || `行 ${match.spec_sheet_item_row}`}
                        </Typography>
                        <Chip
                          label={`${Math.round(match.confidence * 100)}%一致`}
                          size="small"
                          color={match.confidence >= 0.9 ? 'success' : 'warning'}
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" component="span">
                          図番: {match.spec_sheet_item_drawing_number}
                        </Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary" component="span">
                          → {match.drawing_filename}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <LinkOffIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">
                紐づけ候補の図面が見つかりませんでした
              </Typography>
              <Typography variant="body2" color="text.secondary">
                宙に浮いている図面の図番と摘要表の図番が一致するものはありません
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>キャンセル</Button>
          <Button
            onClick={handleLinkDrawings}
            variant="contained"
            disabled={selectedCount === 0 || isLinkingDrawings}
            startIcon={isLinkingDrawings ? <CircularProgress size={16} /> : <LinkIcon />}
          >
            {selectedCount > 0 ? `${selectedCount}件を紐づける` : '紐づける'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 図面選択ダイアログ */}
      <DrawingSelectDialog
        open={drawingSelectDialogOpen}
        onClose={() => {
          setDrawingSelectDialogOpen(false);
          setSelectedItemForDrawing(null);
        }}
        onSelect={handleDrawingSelect}
        itemName={selectedItemForDrawing?.part_name}
        itemDrawingNumber={selectedItemForDrawing?.drawing_number}
      />

      {/* Webリンクダイアログ */}
      <WebLinkDialog
        open={webLinkDialogOpen}
        onClose={() => {
          setWebLinkDialogOpen(false);
          setSelectedItemForWebLink(null);
        }}
        onSave={handleSaveWebLink}
        currentWebLink={selectedItemForWebLink?.web_link ?? null}
        itemName={selectedItemForWebLink?.part_name ?? null}
        isPending={isUpdatingWebLink}
      />

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>摘要表削除の確認</DialogTitle>
        <DialogContent>
          <Typography>
            この摘要表を削除してもよろしいですか？
            <br />
            紐づいている図面との関連も解除されます。この操作は取り消せません。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
            キャンセル
          </Button>
          <Button
            onClick={handleDelete}
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
