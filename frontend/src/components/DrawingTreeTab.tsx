/**
 * DrawingTreeTab - 図面ツリータブコンポーネント
 *
 * 組図（assembly）→ ユニット図（unit）→ 部品図（part）の階層を表示するツリービュー
 * parent_nameを使って親子関係を推定し、ツリー構造を構築
 */

import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  SimpleTreeView,
  TreeItem,
} from '@mui/x-tree-view';
import {
  AccountTree as AccountTreeIcon,
  Visibility as VisibilityIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type { SpecSheetItem } from '../types/spec-sheet';

interface DrawingTreeTabProps {
  items: SpecSheetItem[];
  onItemClick?: (item: SpecSheetItem) => void;
}

// ツリーノード型
interface TreeNode {
  item: SpecSheetItem;
  children: TreeNode[];
}

// 部品タイプラベルを取得
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

// 部品タイプの色を取得
const getPartTypeColor = (partType: string): 'primary' | 'secondary' | 'success' | 'warning' | 'default' => {
  switch (partType) {
    case 'assembly':
      return 'primary';
    case 'unit':
      return 'secondary';
    case 'part':
      return 'success';
    case 'purchased':
      return 'warning';
    default:
      return 'default';
  }
};

export const DrawingTreeTab = ({ items, onItemClick }: DrawingTreeTabProps) => {
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // ツリー構造を構築
  const treeData = useMemo(() => {
    // 図面を持つアイテムのみをフィルタリング（assembly, unit, part）
    // purchasedは除外（通常図面を持たない）
    const drawingItems = items.filter(
      (item) => item.part_type === 'assembly' || item.part_type === 'unit' || item.part_type === 'part'
    );

    // 品名→アイテムのマップを作成（親を見つけるため）
    const itemByName = new Map<string, SpecSheetItem>();
    drawingItems.forEach((item) => {
      if (item.part_name) {
        // 最初に見つかったものを採用（row_numberが小さいもの優先のため事前にソート）
        if (!itemByName.has(item.part_name)) {
          itemByName.set(item.part_name, item);
        }
      }
    });

    // ID→アイテムのマップを作成
    const itemById = new Map<string, SpecSheetItem>();
    drawingItems.forEach((item) => itemById.set(item.id, item));

    // ツリーノードを構築
    const nodeMap = new Map<string, TreeNode>();
    drawingItems.forEach((item) => {
      nodeMap.set(item.id, { item, children: [] });
    });

    // 親子関係を構築
    const rootNodes: TreeNode[] = [];
    drawingItems.forEach((item) => {
      const node = nodeMap.get(item.id);
      if (!node) return;

      let parentFound = false;

      // 1. parent_item_idがある場合はそれを使用
      if (item.parent_item_id && nodeMap.has(item.parent_item_id)) {
        const parentNode = nodeMap.get(item.parent_item_id);
        parentNode?.children.push(node);
        parentFound = true;
      }
      // 2. parent_nameから親を探す（「組図」は除外）
      else if (item.parent_name && item.parent_name !== '組図' && item.parent_name !== '追加工図') {
        const parentItem = itemByName.get(item.parent_name);
        if (parentItem && parentItem.id !== item.id && nodeMap.has(parentItem.id)) {
          const parentNode = nodeMap.get(parentItem.id);
          parentNode?.children.push(node);
          parentFound = true;
        }
      }

      // 親が見つからない場合はルートノード
      if (!parentFound) {
        rootNodes.push(node);
      }
    });

    // row_number でソート
    const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
      nodes.sort((a, b) => a.item.row_number - b.item.row_number);
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          sortNodes(node.children);
        }
      });
      return nodes;
    };

    return sortNodes(rootNodes);
  }, [items]);

  // 全ノードIDを取得（展開用）
  const allNodeIds = useMemo(() => {
    const ids: string[] = [];
    const collectIds = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        ids.push(node.item.id);
        if (node.children.length > 0) {
          collectIds(node.children);
        }
      });
    };
    collectIds(treeData);
    return ids;
  }, [treeData]);

  // 初期展開（最初のレンダリング時に全展開）
  useState(() => {
    if (expandedItems.length === 0 && allNodeIds.length > 0) {
      setExpandedItems(allNodeIds);
    }
  });

  // 全展開/全折りたたみ
  const handleExpandAll = useCallback(() => {
    setExpandedItems(allNodeIds);
  }, [allNodeIds]);

  const handleCollapseAll = useCallback(() => {
    setExpandedItems([]);
  }, []);

  // ツリーアイテムをレンダリング
  const renderTreeItem = (node: TreeNode): React.ReactNode => {
    const { item } = node;
    const hasLinkedDrawing = !!item.linked_drawing_id;
    const hasDrawingNumber = !!item.drawing_number;

    const label = (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 0.5,
          pr: 1,
          // 図面未紐づけの場合は背景を薄く
          opacity: hasLinkedDrawing ? 1 : 0.7,
        }}
      >
        <Chip
          label={getPartTypeLabel(item.part_type)}
          size="small"
          color={getPartTypeColor(item.part_type)}
          variant={hasLinkedDrawing ? 'filled' : 'outlined'}
          sx={{ minWidth: 70, fontWeight: hasLinkedDrawing ? 'bold' : 'normal' }}
        />
        <Typography
          variant="body2"
          sx={{
            flexGrow: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: hasLinkedDrawing ? 500 : 400,
            color: hasLinkedDrawing ? 'text.primary' : 'text.secondary',
          }}
        >
          {item.part_name || item.drawing_number || `No.${item.row_number}`}
        </Typography>
        {hasDrawingNumber && (
          <Typography
            variant="caption"
            color={hasLinkedDrawing ? 'text.secondary' : 'text.disabled'}
            sx={{ ml: 1 }}
          >
            {item.drawing_number}
          </Typography>
        )}
        {hasLinkedDrawing ? (
          <Tooltip title="図面を表示">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/edit/${item.linked_drawing_id}`);
              }}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : hasDrawingNumber ? (
          <Tooltip title="図面番号はあるが、図面データ未登録">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WarningIcon fontSize="small" color="warning" />
              <LinkOffIcon fontSize="small" color="disabled" />
            </Box>
          </Tooltip>
        ) : (
          <Tooltip title="図面番号なし">
            <LinkIcon fontSize="small" color="disabled" />
          </Tooltip>
        )}
      </Box>
    );

    return (
      <TreeItem
        key={item.id}
        itemId={item.id}
        label={label}
        onClick={() => onItemClick?.(item)}
      >
        {node.children.map(renderTreeItem)}
      </TreeItem>
    );
  };

  // 統計情報を計算
  const stats = useMemo(() => {
    let totalCount = 0;
    let linkedCount = 0;
    let unlinkedWithNumberCount = 0;

    const countNodes = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        totalCount++;
        if (node.item.linked_drawing_id) {
          linkedCount++;
        } else if (node.item.drawing_number) {
          unlinkedWithNumberCount++;
        }
        countNodes(node.children);
      });
    };
    countNodes(treeData);

    return { totalCount, linkedCount, unlinkedWithNumberCount };
  }, [treeData]);

  if (treeData.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <AccountTreeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography color="text.secondary">
          組図・ユニット図・部品図がありません
        </Typography>
        <Typography variant="body2" color="text.secondary">
          部品・図面一覧タブで種別を設定してください
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ツールバー */}
      <Box sx={{ display: 'flex', gap: 1, p: 1, borderBottom: 1, borderColor: 'divider', alignItems: 'center', flexWrap: 'wrap' }}>
        <Tooltip title="すべて展開">
          <IconButton size="small" onClick={handleExpandAll}>
            <ExpandMoreIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="すべて折りたたむ">
          <IconButton size="small" onClick={handleCollapseAll}>
            <ChevronRightIcon />
          </IconButton>
        </Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        {/* 統計情報 */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={`全${stats.totalCount}件`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`登録済 ${stats.linkedCount}件`}
            size="small"
            color="primary"
            variant="filled"
          />
          {stats.unlinkedWithNumberCount > 0 && (
            <Chip
              label={`未登録 ${stats.unlinkedWithNumberCount}件`}
              size="small"
              color="warning"
              variant="outlined"
              icon={<WarningIcon />}
            />
          )}
        </Box>
      </Box>

      {/* 凡例 */}
      <Box sx={{ display: 'flex', gap: 2, px: 2, py: 1, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip label="組図" size="small" color="primary" sx={{ minWidth: 60 }} />
          <Typography variant="caption" color="text.secondary">トップレベル</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip label="ユニット" size="small" color="secondary" sx={{ minWidth: 60 }} />
          <Typography variant="caption" color="text.secondary">サブアセンブリ</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip label="部品" size="small" color="success" sx={{ minWidth: 60 }} />
          <Typography variant="caption" color="text.secondary">単品図面</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <WarningIcon fontSize="small" color="warning" />
          <Typography variant="caption" color="text.secondary">図面データ未登録</Typography>
        </Box>
      </Box>

      {/* ツリービュー */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
        <SimpleTreeView
          expandedItems={expandedItems}
          onExpandedItemsChange={(_, newExpandedItems) => setExpandedItems(newExpandedItems)}
          slots={{
            collapseIcon: ExpandMoreIcon,
            expandIcon: ChevronRightIcon,
          }}
        >
          {treeData.map(renderTreeItem)}
        </SimpleTreeView>
      </Box>
    </Box>
  );
};
