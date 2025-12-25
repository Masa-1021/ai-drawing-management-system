/**
 * ライン・設備 手動作成ダイアログ
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  Divider,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { createLine } from '../api/lines';
import { createEquipment } from '../api/equipments';
import { useNavigate } from 'react-router-dom';

interface EquipmentInput {
  name: string;
  code: string;
}

interface LineCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LineCreateDialog({ open, onClose, onSuccess }: LineCreateDialogProps) {
  const navigate = useNavigate();
  const [lineName, setLineName] = useState('');
  const [lineCode, setLineCode] = useState('');
  const [equipments, setEquipments] = useState<EquipmentInput[]>([{ name: '', code: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddEquipment = () => {
    setEquipments([...equipments, { name: '', code: '' }]);
  };

  const handleRemoveEquipment = (index: number) => {
    if (equipments.length > 1) {
      setEquipments(equipments.filter((_, i) => i !== index));
    }
  };

  const handleEquipmentChange = (index: number, field: keyof EquipmentInput, value: string) => {
    const newEquipments = [...equipments];
    newEquipments[index][field] = value;
    setEquipments(newEquipments);
  };

  const handleSave = async () => {
    // バリデーション
    if (!lineName.trim()) {
      setError('ライン名を入力してください');
      return;
    }

    const validEquipments = equipments.filter((eq) => eq.name.trim());
    if (validEquipments.length === 0) {
      setError('少なくとも1つの設備を入力してください');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // ラインを作成
      const createdLine = await createLine({
        name: lineName.trim(),
        code: lineCode.trim() || undefined,
      });

      // 設備を作成
      for (const eq of validEquipments) {
        await createEquipment({
          line_id: createdLine.id,
          name: eq.name.trim(),
          code: eq.code.trim() || eq.name.trim(), // コードが空の場合は名前を使用
        });
      }

      // 成功時の処理
      onSuccess?.();
      handleClose();
      navigate(`/equipment/${createdLine.id}`);
    } catch (err) {
      console.error('Failed to create line:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('ラインの作成に失敗しました');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setLineName('');
    setLineCode('');
    setEquipments([{ name: '', code: '' }]);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>ライン・設備を手動作成</DialogTitle>
      <DialogContent>
        <div className="space-y-4 mt-2">
          {/* ライン情報 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-me-grey-dark">ライン情報</h3>
            <TextField
              label="ライン名"
              value={lineName}
              onChange={(e) => setLineName(e.target.value)}
              fullWidth
              required
              size="small"
              placeholder="例: 第1ライン"
            />
            <TextField
              label="ラインコード（任意）"
              value={lineCode}
              onChange={(e) => setLineCode(e.target.value)}
              fullWidth
              size="small"
              placeholder="例: LINE001"
            />
          </div>

          <Divider />

          {/* 設備情報 */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-me-grey-dark">設備情報</h3>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddEquipment}
              >
                設備を追加
              </Button>
            </div>

            {equipments.map((eq, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <TextField
                    label={`設備名 ${index + 1}`}
                    value={eq.name}
                    onChange={(e) => handleEquipmentChange(index, 'name', e.target.value)}
                    fullWidth
                    required
                    size="small"
                    placeholder="例: 搬送コンベア"
                  />
                  <TextField
                    label={`設備コード ${index + 1}（任意）`}
                    value={eq.code}
                    onChange={(e) => handleEquipmentChange(index, 'code', e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="例: EQ001"
                  />
                </div>
                {equipments.length > 1 && (
                  <IconButton
                    onClick={() => handleRemoveEquipment(index)}
                    color="error"
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </div>
            ))}
          </div>

          {/* エラーメッセージ */}
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={saving}
        >
          {saving ? '作成中...' : '作成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
