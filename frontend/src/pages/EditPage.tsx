/**
 * 編集ページ（2分割レイアウト）
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { drawingsApi } from '../api/drawings';
import { lockApi } from '../api/locks';
import { useDrawingStore } from '../stores/drawingStore';
import { websocketClient } from '../lib/websocket';
import EditForm from '../components/EditForm';
import PDFViewer from '../components/PDFViewer';
import type { Drawing } from '../types/drawing';

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedDrawing, setSelectedDrawing, updateDrawing, setLoading, isLoading } =
    useDrawingStore();

  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string | null>(null);

  // ユーザーIDをlocalStorageで永続化（ブラウザごとに固定）
  const [userId] = useState(() => {
    const stored = localStorage.getItem('cad_user_id');
    if (stored) {
      return stored;
    }
    const newId = `user-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('cad_user_id', newId);
    return newId;
  });

  useEffect(() => {
    if (id) {
      loadDrawing(id);
      acquireLock(id);

      // WebSocket接続と購読
      websocketClient.connect();
      websocketClient.subscribeDrawing(id, (data) => {
        if (data.type === 'locked' && data.locked_by !== userId) {
          setIsLocked(true);
          setLockedBy(data.locked_by || null);
          toast.error(`${data.locked_by}が編集中です`);
        } else if (data.type === 'unlocked') {
          setIsLocked(false);
          setLockedBy(null);
          toast.success('編集ロックが解除されました');
        }
      });

      // クリーンアップ
      return () => {
        releaseLock(id);
        websocketClient.unsubscribeDrawing(id);
      };
    }
  }, [id]);

  const loadDrawing = async (drawingId: string) => {
    try {
      setLoading(true);
      const drawing = await drawingsApi.get(drawingId);
      setSelectedDrawing(drawing);
    } catch (error) {
      console.error('Failed to load drawing:', error);
      toast.error('図面の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const acquireLock = async (drawingId: string) => {
    try {
      await lockApi.acquireLock(drawingId, userId);
      setIsLocked(false);
      setLockedBy(null);
    } catch (error) {
      console.error('Failed to acquire lock:', error);
      // ロック取得失敗時は他のユーザーがロック中
      try {
        const lock = await lockApi.checkLock(drawingId);
        if (lock) {
          setIsLocked(true);
          setLockedBy(lock.user_id);
          toast.error(`${lock.user_id}が編集中です（読み取り専用）`);
        }
      } catch (e) {
        // Lock check failed, continue
      }
    }
  };

  const releaseLock = async (drawingId: string) => {
    try {
      await lockApi.releaseLock(drawingId, userId);
    } catch (error) {
      console.error('Failed to release lock:', error);
    }
  };

  const handleSave = async (data: Partial<Drawing>) => {
    if (!selectedDrawing) return;

    if (isLocked) {
      toast.error('編集ロック中のため保存できません');
      return;
    }

    try {
      setLoading(true);
      await drawingsApi.update(selectedDrawing.id, data);

      // 保存後、サーバーから最新データを再読み込み
      const updatedDrawing = await drawingsApi.get(selectedDrawing.id);
      setSelectedDrawing(updatedDrawing);

      toast.success('保存しました');
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedDrawing) return;

    try {
      setLoading(true);
      await drawingsApi.approve(selectedDrawing.id);
      updateDrawing(selectedDrawing.id, { status: 'approved' });
      toast.success('承認しました');
      navigate('/list');
    } catch (error) {
      console.error('Failed to approve:', error);
      toast.error('承認に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDrawing) return;

    try {
      setLoading(true);
      await drawingsApi.unapprove(selectedDrawing.id);
      updateDrawing(selectedDrawing.id, { status: 'unapproved' });
      toast.success('承認を取り消しました');
    } catch (error) {
      console.error('Failed to reject:', error);
      toast.error('取り消しに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!selectedDrawing) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">図面が見つかりません</p>
        <button
          onClick={() => navigate('/list')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          一覧に戻る
        </button>
      </div>
    );
  }

  // PDFのURL - pdf_pathから実際のファイル名を取得
  // Windowsのバックスラッシュとスラッシュの両方に対応
  const actualFilename = selectedDrawing.pdf_path
    ? (selectedDrawing.pdf_path.split(/[/\\]/).pop() || selectedDrawing.pdf_filename)
    : selectedDrawing.pdf_filename;
  const pdfUrl = `http://localhost:8000/storage/drawings/${actualFilename}`;

  console.log('[DEBUG] EditPage PDF info:', {
    pdf_path: selectedDrawing.pdf_path,
    pdf_filename: selectedDrawing.pdf_filename,
    actualFilename,
    pdfUrl,
  });

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {selectedDrawing.pdf_filename}
          </h1>
          {selectedDrawing.original_filename && (
            <p className="text-xs text-gray-500 mt-1">元のファイル名: {selectedDrawing.original_filename}</p>
          )}
          {isLocked && lockedBy && (
            <div className="mt-2 px-3 py-1 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-md inline-block">
              🔒 {lockedBy}が編集中（読み取り専用）
            </div>
          )}
        </div>
        <button
          onClick={() => navigate('/list')}
          className="px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          ← 一覧に戻る
        </button>
      </div>

      {/* 2分割レイアウト */}
      <div className="grid grid-cols-3 gap-6">
        {/* 左側: 編集フォーム (30%) */}
        <div className="col-span-1">
          <EditForm
            drawing={selectedDrawing}
            onSave={handleSave}
            onApprove={handleApprove}
            onReject={handleReject}
            disabled={isLocked}
          />
        </div>

        {/* 右側: PDFビューアー (70%) */}
        <div className="col-span-2">
          <PDFViewer
            pdfUrl={pdfUrl}
            pageNumber={selectedDrawing.page_number + 1}
          />
        </div>
      </div>
    </div>
  );
}
