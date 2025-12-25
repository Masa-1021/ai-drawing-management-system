/**
 * 図面一覧ページ
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { drawingsApi } from '../api/drawings';
import { useDrawingStore } from '../stores/drawingStore';
import FilterSidebar, { FilterOptions } from '../components/FilterSidebar';

export default function ListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { drawings, setDrawings, setLoading, isLoading } = useDrawingStore();

  // URLクエリパラメータから初期フィルタを取得
  const getFiltersFromURL = (): FilterOptions => {
    return {
      classification: searchParams.get('classification') || '',
      search: searchParams.get('search') || '',
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || [],
    };
  };

  const [filters, setFilters] = useState<FilterOptions>(getFiltersFromURL());
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // フィルタを変更してURLも更新
  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);

    // URLクエリパラメータを更新
    const params = new URLSearchParams();
    if (newFilters.classification) {
      params.set('classification', newFilters.classification);
    }
    if (newFilters.search) {
      params.set('search', newFilters.search);
    }
    if (newFilters.tags.length > 0) {
      params.set('tags', newFilters.tags.join(','));
    }
    setSearchParams(params);
  };

  useEffect(() => {
    loadDrawings();
  }, [filters]);

  const loadDrawings = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };

      if (filters.classification) {
        params.classification = filters.classification;
      }
      if (filters.search) {
        params.search = filters.search;
      }
      if (filters.tags.length > 0) {
        params.tags = filters.tags.join(',');
      }

      const response = await drawingsApi.list(params);
      setDrawings(response.items);
    } catch (error) {
      console.error('Failed to load drawings:', error);
      toast.error('図面の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 利用可能なタグを取得
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    drawings.forEach((drawing) => {
      drawing.tags?.forEach((tag) => tagSet.add(tag.tag_name));
    });
    return Array.from(tagSet).sort();
  }, [drawings]);

  // チェックボックスの選択/解除
  const handleToggleSelect = (drawingId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedDrawingIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(drawingId)) {
        newSet.delete(drawingId);
      } else {
        newSet.add(drawingId);
      }
      return newSet;
    });
  };

  // 全選択/全解除
  const handleToggleSelectAll = () => {
    if (selectedDrawingIds.size === drawings.length) {
      setSelectedDrawingIds(new Set());
    } else {
      setSelectedDrawingIds(new Set(drawings.map((d) => d.id)));
    }
  };

  // 削除実行
  const handleDelete = async () => {
    if (selectedDrawingIds.size === 0) return;

    try {
      setLoading(true);
      await drawingsApi.bulkDelete(Array.from(selectedDrawingIds));
      toast.success(`${selectedDrawingIds.size}件の図面を削除しました`);
      setSelectedDrawingIds(new Set());
      setShowDeleteConfirm(false);
      await loadDrawings();
    } catch (error) {
      console.error('Failed to delete drawings:', error);
      toast.error('図面の削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      pending: { color: 'bg-[#F2F2F2] text-[#333333]', text: '待機中' },
      analyzing: { color: 'bg-[#2A60AD] text-white', text: '解析中' },
      approved: { color: 'bg-[#FF0000] text-white', text: '承認済み' },
      unapproved: { color: 'bg-[#333333] text-white', text: '未承認' },
      failed: { color: 'bg-[#FF0000] text-white', text: '失敗' },
    };

    const badge = badges[status] || badges.unapproved;

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-me ${badge.color} shadow-sm`}>
        {badge.text}
      </span>
    );
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

  return (
    <div className="flex h-full">
      {/* フィルタサイドバー */}
      <FilterSidebar
        onFilterChange={handleFilterChange}
        availableTags={availableTags}
        currentFilters={filters}
      />

      {/* メインコンテンツ */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-me-grey-deep">図面一覧</h1>
              <p className="text-sm text-me-grey-dark mt-1">
                {drawings.length}件の図面
                {selectedDrawingIds.size > 0 && (
                  <span className="ml-2 text-me-red">
                    ({selectedDrawingIds.size}件選択中)
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              {selectedDrawingIds.size > 0 && (
                <>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-3 bg-me-red text-white rounded-me hover:bg-red-700 transition-colors font-medium"
                  >
                    選択した図面を削除 ({selectedDrawingIds.size})
                  </button>
                  <button
                    onClick={() => setSelectedDrawingIds(new Set())}
                    className="px-4 py-3 bg-me-grey-medium text-me-grey-deep rounded-me hover:bg-me-grey-dark hover:text-white transition-colors font-medium"
                  >
                    選択解除
                  </button>
                </>
              )}
              <button
                onClick={loadDrawings}
                className="px-4 py-3 bg-[#FF0000] text-white rounded-me hover:bg-[#FF3333] transition-colors font-medium"
              >
                更新
              </button>
            </div>
          </div>

          {drawings.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-me border border-me-grey-medium">
              <p className="text-me-grey-dark">図面がありません</p>
              <button
                onClick={() => navigate('/upload')}
                className="mt-4 px-4 py-3 bg-[#FF0000] text-white rounded-me hover:bg-[#FF3333] font-medium"
              >
                図面をアップロード
              </button>
            </div>
          ) : (
            <>
              {/* 全選択ボタン */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={handleToggleSelectAll}
                  className="px-3 py-2 text-sm bg-me-grey-light text-me-grey-deep rounded-me hover:bg-me-grey-medium transition-colors"
                >
                  {selectedDrawingIds.size === drawings.length ? '全選択解除' : '全選択'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {drawings.map((drawing) => (
                <div
                  key={drawing.id}
                  className={`bg-white rounded-me border overflow-hidden hover:border-me-red transition-colors cursor-pointer ${
                    selectedDrawingIds.has(drawing.id)
                      ? 'border-me-red ring-2 ring-me-red ring-opacity-50'
                      : 'border-me-grey-medium'
                  }`}
                  onClick={() => navigate(`/edit/${drawing.id}`)}
                >
                  {/* サムネイル */}
                  <div className="h-48 bg-me-grey-light flex items-center justify-center overflow-hidden relative">
                    {/* チェックボックス（右上） */}
                    <div className="absolute top-2 right-2 z-10">
                      <input
                        type="checkbox"
                        checked={selectedDrawingIds.has(drawing.id)}
                        onChange={(e) => handleToggleSelect(drawing.id, e as any)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 rounded border-2 border-white shadow-lg cursor-pointer accent-me-red"
                      />
                    </div>
                    {drawing.thumbnail_path ? (
                      <img
                        src={`/storage/thumbnails/${drawing.thumbnail_path}`}
                        alt={`${drawing.pdf_filename} サムネイル`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-me-grey-medium">サムネイル</span>
                    )}
                    {/* 承認状態バッジ（サムネイル右下） */}
                    <div className="absolute bottom-2 right-2">
                      {getStatusBadge(drawing.status)}
                    </div>
                  </div>

                  {/* 情報 */}
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-me-grey-deep truncate">
                        {drawing.pdf_filename}
                      </h3>
                    </div>

                    <div className="text-sm text-me-grey-dark space-y-1">
                      {drawing.original_filename && (
                        <p className="text-xs text-me-grey-medium">
                          元のファイル名: {drawing.original_filename}
                        </p>
                      )}
                      <p>分類: {drawing.classification || '未分類'}</p>
                      <p>ページ: {drawing.page_number + 1}</p>
                      <p>作成者: {drawing.created_by}</p>

                      {/* 摘要表紐づけ情報 */}
                      {drawing.spec_sheet_item && (
                        <div className="mt-2 p-2 bg-blue-50 rounded-me border border-blue-200">
                          <p className="text-xs font-medium text-blue-800">
                            摘要表紐づけ済
                          </p>
                          <p className="text-xs text-blue-700">
                            摘番: {drawing.spec_sheet_item.spec_number}
                          </p>
                          {drawing.spec_sheet_item.part_name && (
                            <p className="text-xs text-blue-600 truncate">
                              品名: {drawing.spec_sheet_item.part_name}
                            </p>
                          )}
                          {(drawing.spec_sheet_item.line_name || drawing.spec_sheet_item.equipment_name) && (
                            <p className="text-xs text-blue-600 truncate">
                              {drawing.spec_sheet_item.line_name && `${drawing.spec_sheet_item.line_name}`}
                              {drawing.spec_sheet_item.line_name && drawing.spec_sheet_item.equipment_name && ' > '}
                              {drawing.spec_sheet_item.equipment_name}
                            </p>
                          )}
                        </div>
                      )}

                      {/* タグ表示 */}
                      {drawing.tags && drawing.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {drawing.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="px-2 py-0.5 text-xs bg-me-grey-light text-me-grey-dark rounded-me border border-me-grey-medium"
                            >
                              {tag.tag_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-me-grey-medium">
                      {new Date(drawing.upload_date).toLocaleString('ja-JP')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-me p-6 max-w-md w-full mx-4 shadow-xl">
            <h2 className="text-xl font-bold text-me-grey-deep mb-4">
              図面の削除確認
            </h2>
            <p className="text-me-grey-dark mb-6">
              選択した{selectedDrawingIds.size}件の図面を削除しますか？
              <br />
              <span className="text-me-red text-sm font-medium">
                この操作は取り消せません。
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-me-grey-light text-me-grey-deep rounded-me hover:bg-me-grey-medium transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-me-red text-white rounded-me hover:bg-red-700 transition-colors font-medium"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
