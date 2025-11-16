import { useState, useEffect } from 'react';

export interface FilterOptions {
  classification: string;
  search: string;
  tags: string[];
}

interface FilterSidebarProps {
  onFilterChange: (filters: FilterOptions) => void;
  availableTags: string[];
  currentFilters: FilterOptions;
}

export default function FilterSidebar({
  onFilterChange,
  availableTags,
  currentFilters,
}: FilterSidebarProps) {
  const [classification, setClassification] = useState<string>(currentFilters.classification);
  const [search, setSearch] = useState<string>(currentFilters.search);
  const [selectedTags, setSelectedTags] = useState<string[]>(currentFilters.tags);

  // currentFiltersが変更されたら、内部状態も更新
  useEffect(() => {
    setClassification(currentFilters.classification);
    setSearch(currentFilters.search);
    setSelectedTags(currentFilters.tags);
  }, [currentFilters]);

  const handleApply = () => {
    onFilterChange({ classification, search, tags: selectedTags });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newTags);
  };

  const handleReset = () => {
    setClassification('');
    setSearch('');
    setSelectedTags([]);
    onFilterChange({ classification: '', search: '', tags: [] });
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 p-4 space-y-6 overflow-y-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">フィルタ</h2>
        <button
          onClick={handleReset}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          リセット
        </button>
      </div>

      {/* 分類フィルタ */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">分類</h3>
        <div className="space-y-2">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="classification"
              value=""
              checked={classification === ''}
              onChange={(e) => setClassification(e.target.value)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">すべて</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="classification"
              value="組図"
              checked={classification === '組図'}
              onChange={(e) => setClassification(e.target.value)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">組図</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="classification"
              value="ユニット図"
              checked={classification === 'ユニット図'}
              onChange={(e) => setClassification(e.target.value)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">ユニット図</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="classification"
              value="部品図"
              checked={classification === '部品図'}
              onChange={(e) => setClassification(e.target.value)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">部品図</span>
          </label>
        </div>
      </div>

      {/* ファイル名検索 */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">ファイル名検索</h3>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ファイル名を入力..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* タグフィルタ */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">タグ</h3>
        {availableTags.length === 0 ? (
          <p className="text-xs text-gray-500">タグがありません</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {availableTags.map((tag) => (
              <label key={tag} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={() => handleTagToggle(tag)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">{tag}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 適用ボタン */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={handleApply}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          フィルタを適用
        </button>
      </div>

      {/* 現在の選択表示 */}
      {(classification || search || selectedTags.length > 0) && (
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            現在の選択
          </h3>
          <div className="space-y-1">
            {classification && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">分類: {classification}</span>
                <button
                  onClick={() => setClassification('')}
                  className="text-red-600 hover:text-red-800"
                >
                  ×
                </button>
              </div>
            )}
            {search && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 truncate">検索: {search}</span>
                <button
                  onClick={() => setSearch('')}
                  className="text-red-600 hover:text-red-800"
                >
                  ×
                </button>
              </div>
            )}
            {selectedTags.map((tag) => (
              <div key={tag} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">タグ: {tag}</span>
                <button
                  onClick={() => handleTagToggle(tag)}
                  className="text-red-600 hover:text-red-800"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
