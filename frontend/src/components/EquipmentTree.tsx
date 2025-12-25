/**
 * 設備ツリービュー - ライン＞設備の階層構造を表示
 */

import { useState } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Checkbox,
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { ExpandMore, ChevronRight, Delete as DeleteIcon } from '@mui/icons-material';
import { useLines } from '../hooks/useLines';
import { useEquipments } from '../hooks/useEquipments';
import { deleteEquipment } from '../api/equipments';

interface EquipmentTreeProps {
  selectedEquipmentId?: string;
  onEquipmentSelect: (equipmentId: string) => void;
}

export const EquipmentTree = ({
  selectedEquipmentId,
  onEquipmentSelect,
}: EquipmentTreeProps) => {
  const { data: lines, isLoading: linesLoading, error: linesError } = useLines();
  const { data: equipments, isLoading: equipmentsLoading, error: equipmentsError, refetch: refetchEquipments } = useEquipments();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<string>>(new Set());

  if (linesLoading || equipmentsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (linesError) {
    return (
      <Box p={2}>
        <Typography color="error">
          ラインの読み込みに失敗しました: {linesError.message}
        </Typography>
      </Box>
    );
  }

  if (equipmentsError) {
    return (
      <Box p={2}>
        <Typography color="error">
          設備の読み込みに失敗しました: {equipmentsError.message}
        </Typography>
      </Box>
    );
  }

  if (!lines || lines.length === 0) {
    return (
      <Box p={2}>
        <Typography color="textSecondary">
          ラインが登録されていません
        </Typography>
      </Box>
    );
  }

  const handleEquipmentCheckboxChange = (equipmentId: string, checked: boolean) => {
    setSelectedEquipmentIds((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(equipmentId);
      } else {
        newSet.delete(equipmentId);
      }
      return newSet;
    });
  };

  const handleSelectAllEquipments = (checked: boolean) => {
    if (checked && equipments) {
      setSelectedEquipmentIds(new Set(equipments.map((eq) => eq.id)));
    } else {
      setSelectedEquipmentIds(new Set());
    }
  };

  const handleDeleteSelected = () => {
    if (selectedEquipmentIds.size === 0) return;
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);

      // 選択された設備を削除
      if (selectedEquipmentIds.size > 0) {
        await Promise.all(
          Array.from(selectedEquipmentIds).map((equipmentId) =>
            deleteEquipment(equipmentId)
          )
        );
        setSelectedEquipmentIds(new Set());
      }

      await refetchEquipments(); // 削除後に設備リストを再読み込み
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error('Failed to delete equipment:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  // ラインごとに設備をグループ化
  type EquipmentsArray = NonNullable<typeof equipments>;
  const equipmentsByLine = (equipments || []).reduce<Record<string, EquipmentsArray>>((acc, equipment) => {
    if (!acc[equipment.line_id]) {
      acc[equipment.line_id] = [];
    }
    acc[equipment.line_id].push(equipment);
    return acc;
  }, {});

  const totalEquipments = equipments?.length || 0;

  return (
    <>
      {/* ヘッダー: 全選択チェックボックスと削除ボタン */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Checkbox
            checked={
              selectedEquipmentIds.size === totalEquipments && totalEquipments > 0
            }
            indeterminate={
              selectedEquipmentIds.size > 0 &&
              selectedEquipmentIds.size < totalEquipments
            }
            onChange={(e) => handleSelectAllEquipments(e.target.checked)}
          />
          <Typography variant="body2" color="textSecondary">
            すべて選択
          </Typography>
        </Box>
        {selectedEquipmentIds.size > 0 && (
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon fontSize="small" />}
            onClick={handleDeleteSelected}
          >
            削除 ({selectedEquipmentIds.size})
          </Button>
        )}
      </Box>

      <SimpleTreeView
        slots={{
          collapseIcon: ExpandMore,
          expandIcon: ChevronRight,
        }}
        selectedItems={selectedEquipmentId || ''}
        sx={{ flexGrow: 1, overflowY: 'auto', mt: 2 }}
      >
        {lines.map((line) => {
          const lineEquipments = equipmentsByLine[line.id] || [];

          return (
            <TreeItem
              key={line.id}
              itemId={line.id}
              label={
                <Box display="flex" alignItems="center" py={0.5}>
                  <Typography variant="body1" fontWeight="medium">
                    {line.name}
                  </Typography>
                  {line.code && (
                    <Typography variant="caption" color="textSecondary" ml={1}>
                      ({line.code})
                    </Typography>
                  )}
                </Box>
              }
            >
              {lineEquipments.length === 0 ? (
                <TreeItem
                  itemId={`${line.id}-empty`}
                  label={
                    <Typography variant="body2" color="textSecondary">
                      設備なし
                    </Typography>
                  }
                  disabled
                />
              ) : (
                lineEquipments.map((equipment) => (
                  <TreeItem
                    key={equipment.id}
                    itemId={equipment.id}
                    label={
                      <Box display="flex" alignItems="center" py={0.5}>
                        <Checkbox
                          checked={selectedEquipmentIds.has(equipment.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleEquipmentCheckboxChange(equipment.id, e.target.checked);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          size="small"
                        />
                        <Typography variant="body2">
                          {equipment.name}
                        </Typography>
                        {equipment.code && (
                          <Typography variant="caption" color="textSecondary" ml={1}>
                            ({equipment.code})
                          </Typography>
                        )}
                      </Box>
                    }
                    onClick={() => onEquipmentSelect(equipment.id)}
                  />
                ))
              )}
            </TreeItem>
          );
        })}
      </SimpleTreeView>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>設備削除の確認</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {selectedEquipmentIds.size}件の設備を削除してもよろしいですか？
            <br />
            この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            キャンセル
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? '削除中...' : '削除'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
