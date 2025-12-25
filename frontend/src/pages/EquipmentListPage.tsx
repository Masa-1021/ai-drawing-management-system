/**
 * 設備一覧ページ
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Checkbox,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { fetchLines, deleteLine } from '../api/lines';
import type { Line } from '../types/line';
import { OracleLineImportDialog } from '../components/OracleLineImportDialog';
import { LineCreateDialog } from '../components/LineCreateDialog';

export default function EquipmentListPage() {
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOracleDialogOpen, setIsOracleDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadLines();
  }, []);

  const loadLines = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchLines();
      setLines(data);
    } catch (err) {
      console.error('Failed to load lines:', err);
      setError('ライン情報の読込に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleLineCheckboxChange = (lineId: string, checked: boolean) => {
    setSelectedLineIds((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(lineId);
      } else {
        newSet.delete(lineId);
      }
      return newSet;
    });
  };

  const handleSelectAllLines = (checked: boolean) => {
    if (checked) {
      setSelectedLineIds(new Set(lines.map((line) => line.id)));
    } else {
      setSelectedLineIds(new Set());
    }
  };

  const handleDeleteSelected = () => {
    if (selectedLineIds.size === 0) return;
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);

      // 選択されたラインを削除
      if (selectedLineIds.size > 0) {
        await Promise.all(
          Array.from(selectedLineIds).map((lineId) => deleteLine(lineId))
        );
        setSelectedLineIds(new Set());
      }

      await loadLines(); // 削除後にリストを再読み込み
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error('Failed to delete lines:', err);
      setError('ラインの削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-me-grey-dark">読込中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-me-red">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-me-grey-dark">設備一覧</h1>
          {lines.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedLineIds.size === lines.length && lines.length > 0}
                indeterminate={
                  selectedLineIds.size > 0 && selectedLineIds.size < lines.length
                }
                onChange={(e) => handleSelectAllLines(e.target.checked)}
              />
              <span className="text-sm text-me-grey-medium">すべて選択</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {selectedLineIds.size > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteSelected}
            >
              選択を削除 ({selectedLineIds.size})
            </Button>
          )}
          <Button
            variant="outlined"
            color="primary"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            手動で新規作成
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setIsOracleDialogOpen(true)}
          >
            OracleDBから登録
          </Button>
        </div>
      </div>

      {/* OracleLineImportDialog - ダイアログが開いているときのみレンダリング */}
      {isOracleDialogOpen && (
        <OracleLineImportDialog
          open={isOracleDialogOpen}
          onClose={() => setIsOracleDialogOpen(false)}
        />
      )}

      {/* 手動作成ダイアログ */}
      <LineCreateDialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={loadLines}
      />

      {lines.length === 0 ? (
        <div className="bg-white rounded-me shadow-me p-8 text-center text-me-grey-dark">
          ラインが登録されていません
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lines.map((line) => (
            <div key={line.id} className="relative">
              <div className="bg-white rounded-me shadow-me border-l-4 border-me-red hover:shadow-lg transition-shadow">
                <div className="flex items-start p-6">
                  <Checkbox
                    checked={selectedLineIds.has(line.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleLineCheckboxChange(line.id, e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    sx={{ marginTop: '-9px', marginLeft: '-9px' }}
                  />
                  <Link
                    to={`/equipment/${line.id}`}
                    className="flex-1"
                  >
                    <h2 className="text-lg font-bold text-me-grey-dark mb-2">
                      {line.name}
                    </h2>
                    {line.description && (
                      <p className="text-sm text-me-grey-dark">{line.description}</p>
                    )}
                    <div className="mt-4 text-sm text-me-grey-medium">
                      設備詳細を見る →
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>ライン削除の確認</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {selectedLineIds.size}件のラインを削除してもよろしいですか？
            <br />
            これらのライン配下の設備も同時に削除されます。この操作は取り消せません。
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
    </div>
  );
}
