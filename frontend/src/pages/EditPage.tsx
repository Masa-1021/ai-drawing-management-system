/**
 * 編集ページ（2分割レイアウト）
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { drawingsApi } from '../api/drawings';
import { lockApi } from '../api/locks';
import { useDrawingStore } from '../stores/drawingStore';
import EditForm from '../components/EditForm';
import PDFViewer from '../components/PDFViewer';
import type { Drawing, EditHistory } from '../types/drawing';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedDrawing, setSelectedDrawing, updateDrawing, setLoading, isLoading } =
    useDrawingStore();

  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editHistory, setEditHistory] = useState<EditHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

      // WebSocket接続と購読（現在は無効化）
      // websocketClient.connect();
      // websocketClient.subscribeDrawing(id, (data) => {
      //   if (data.type === 'locked' && data.locked_by !== userId) {
      //     setIsLocked(true);
      //     setLockedBy(data.locked_by || null);
      //     toast.error(`${data.locked_by}が編集中です`);
      //   } else if (data.type === 'unlocked') {
      //     setIsLocked(false);
      //     setLockedBy(null);
      //     toast.success('編集ロックが解除されました');
      //   }
      // });

      // クリーンアップ
      return () => {
        const drawingId = id;
        releaseLock(drawingId);
        // websocketClient.unsubscribeDrawing(drawingId);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleBalloonClick = (balloon: { x: number; y: number; width: number; height: number }) => {
    console.log('[DEBUG] Balloon clicked:', balloon);
    setFocusArea(balloon);
    toast.success(`風船位置にズーム: (${balloon.x}, ${balloon.y})`);
  };

  const loadEditHistory = async () => {
    if (!id) return;
    try {
      setHistoryLoading(true);
      const response = await drawingsApi.getEditHistory(id);
      setEditHistory(response.items);
    } catch (error) {
      console.error('Failed to load edit history:', error);
      toast.error('編集履歴の取得に失敗しました');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleHistoryOpen = () => {
    setHistoryOpen(true);
    loadEditHistory();
  };

  const formatFieldName = (fieldName: string): string => {
    const fieldNameMap: Record<string, string> = {
      pdf_filename: 'ファイル名',
      classification: '分類',
      status: 'ステータス',
      summary: '要約',
      spec_number: '摘番',
    };
    return fieldNameMap[fieldName] || fieldName;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-me-red mx-auto"></div>
          <p className="mt-4 text-sm text-me-grey-dark">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!selectedDrawing) {
    return (
      <div className="text-center py-12">
        <p className="text-me-grey-dark">図面が見つかりません</p>
        <button
          onClick={() => navigate('/list')}
          className="mt-4 px-4 py-3 bg-[#FF0000] text-white rounded-me hover:bg-[#FF3333] font-medium"
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

  // Viteプロキシ経由でストレージにアクセス（/storageはバックエンドにプロキシされる）
  const pdfUrl = `/storage/drawings/${actualFilename}`;

  console.log('[DEBUG] EditPage PDF info:', {
    pdf_path: selectedDrawing.pdf_path,
    pdf_filename: selectedDrawing.pdf_filename,
    actualFilename,
    pdfUrl,
  });

  // 風船情報をコンソールに表示
  console.log('[DEBUG] 風船情報 (Balloons):', {
    count: selectedDrawing.balloons?.length || 0,
    balloons: selectedDrawing.balloons,
  });

  // 風船情報を整形して表示
  if (selectedDrawing.balloons && selectedDrawing.balloons.length > 0) {
    console.table(
      selectedDrawing.balloons.map((balloon) => ({
        番号: balloon.balloon_number,
        部品名: balloon.part_name || '(なし)',
        数量: balloon.quantity || '(なし)',
        上部テキスト: balloon.upper_text,
        下部テキスト: balloon.lower_text || '(なし)',
        付随情報: balloon.adjacent_text || '(なし)',
        位置: balloon.adjacent_position || '(なし)',
        信頼度: `${balloon.confidence}%`,
        座標: `(${balloon.x}, ${balloon.y})`,
      }))
    );
  } else {
    console.log('[DEBUG] 風船情報が見つかりません');
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-me-grey-deep">
            {selectedDrawing.pdf_filename}
          </h1>
          {selectedDrawing.original_filename && (
            <p className="text-xs text-me-grey-medium mt-1">元のファイル名: {selectedDrawing.original_filename}</p>
          )}
          {isLocked && lockedBy && (
            <div className="mt-2 px-3 py-1 bg-me-grey-light border border-me-grey-medium text-me-grey-dark rounded-me inline-block">
              🔒 {lockedBy}が編集中（読み取り専用）
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHistoryOpen}
            className="px-4 py-2 border border-me-grey-medium rounded-me text-me-grey-dark hover:bg-me-grey-light flex items-center gap-1"
          >
            <HistoryIcon fontSize="small" />
            修正履歴
          </button>
          <button
            onClick={() => navigate('/list')}
            className="px-4 py-2 text-me-grey-dark hover:text-me-grey-deep"
          >
            ← 一覧に戻る
          </button>
        </div>
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
            onBalloonClick={handleBalloonClick}
          />
        </div>

        {/* 右側: PDFビューアー (70%) */}
        {/* PDFは既に回転補正済みで保存されているため、追加回転は不要 */}
        <div className="col-span-2">
          <PDFViewer
            pdfUrl={pdfUrl}
            pageNumber={selectedDrawing.page_number + 1}
            aiRotation={0}
            focusArea={focusArea}
          />
        </div>
      </div>

      {/* 修正履歴サイドバー */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* オーバーレイ */}
          <div
            className="absolute inset-0 bg-black bg-opacity-30"
            onClick={() => setHistoryOpen(false)}
          />
          {/* サイドバー */}
          <div className="relative w-96 bg-white shadow-lg flex flex-col h-full">
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 border-b border-me-grey-medium">
              <h2 className="text-lg font-bold text-me-grey-deep flex items-center gap-2">
                <HistoryIcon />
                修正履歴
              </h2>
              <button
                onClick={() => setHistoryOpen(false)}
                className="p-1 hover:bg-me-grey-light rounded"
              >
                <CloseIcon />
              </button>
            </div>

            {/* 履歴一覧 */}
            <div className="flex-1 overflow-auto p-4">
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-me-red"></div>
                </div>
              ) : editHistory.length === 0 ? (
                <div className="text-center py-8 text-me-grey-dark">
                  修正履歴はありません
                </div>
              ) : (
                <div className="space-y-4">
                  {editHistory.map((item) => (
                    <div key={item.id} className="border border-me-grey-light rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-me-grey-deep">
                          {formatFieldName(item.field_name)}
                        </span>
                        <span className="text-xs text-me-grey-dark">
                          {new Date(item.timestamp).toLocaleString('ja-JP')}
                        </span>
                      </div>
                      <div className="text-xs text-me-grey-dark mb-1">
                        編集者: {item.user_id}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-red-50 p-2 rounded">
                          <div className="text-xs text-red-600 mb-1">変更前</div>
                          <div className="text-me-grey-deep break-words">
                            {item.old_value || '(空)'}
                          </div>
                        </div>
                        <div className="bg-green-50 p-2 rounded">
                          <div className="text-xs text-green-600 mb-1">変更後</div>
                          <div className="text-me-grey-deep break-words">
                            {item.new_value || '(空)'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
