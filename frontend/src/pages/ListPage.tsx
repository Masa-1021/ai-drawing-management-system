/**
 * 図面一覧ページ
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { drawingsApi } from '../api/drawings';
import { useDrawingStore } from '../stores/drawingStore';

export default function ListPage() {
  const navigate = useNavigate();
  const { drawings, setDrawings, setLoading, isLoading } = useDrawingStore();

  useEffect(() => {
    loadDrawings();
  }, []);

  const loadDrawings = async () => {
    try {
      setLoading(true);
      const response = await drawingsApi.list({ limit: 100 });
      setDrawings(response.items);
    } catch (error) {
      console.error('Failed to load drawings:', error);
      toast.error('図面の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      pending: { color: 'bg-gray-100 text-gray-700', text: '待機中' },
      analyzing: { color: 'bg-blue-100 text-blue-700', text: '解析中' },
      approved: { color: 'bg-green-100 text-green-700', text: '承認済み' },
      unapproved: { color: 'bg-yellow-100 text-yellow-700', text: '未承認' },
      failed: { color: 'bg-red-100 text-red-700', text: '失敗' },
    };

    const badge = badges[status] || badges.unapproved;

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${badge.color}`}>
        {badge.text}
      </span>
    );
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">図面一覧</h1>
        <button
          onClick={loadDrawings}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          更新
        </button>
      </div>

      {drawings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">図面がありません</p>
          <button
            onClick={() => navigate('/upload')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            図面をアップロード
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {drawings.map((drawing) => (
            <div
              key={drawing.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/edit/${drawing.id}`)}
            >
              {/* サムネイル */}
              <div className="h-48 bg-gray-100 flex items-center justify-center">
                <span className="text-gray-400">サムネイル</span>
              </div>

              {/* 情報 */}
              <div className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-medium text-gray-900 truncate">
                    {drawing.pdf_filename}
                  </h3>
                  {getStatusBadge(drawing.status)}
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  <p>分類: {drawing.classification || '未分類'}</p>
                  <p>ページ: {drawing.page_number + 1}</p>
                  <p>作成者: {drawing.created_by}</p>
                </div>

                <div className="text-xs text-gray-500">
                  {new Date(drawing.upload_date).toLocaleString('ja-JP')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
