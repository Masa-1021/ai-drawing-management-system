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
    <div className="w-64 bg-white border-r border-me-grey-medium p-4 space-y-6 overflow-y-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-me-grey-deep">フィルタ</h2>
        <button
          onClick={handleReset}
          className="text-sm text-me-red hover:text-primary-600"
        >
          リセット
        </button>
      </div>

      {/* 分類フィルタ */}
      <div>
        <h3 className="text-sm font-medium text-me-grey-dark mb-2">分類</h3>
        <div className="space-y-2">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="classification"
              value=""
              checked={classification === ''}
              onChange={(e) => setClassification(e.target.value)}
              className="h-4 w-4 text-me-red focus:ring-me-red"
            />
            <span className="ml-2 text-sm text-me-grey-dark">すべて</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="classification"
              value="組図"
              checked={classification === '組図'}
              onChange={(e) => setClassification(e.target.value)}
              className="h-4 w-4 text-me-red focus:ring-me-red"
            />
            <span className="ml-2 text-sm text-me-grey-dark">組図</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="classification"
              value="ユニット図"
              checked={classification === 'ユニット図'}
              onChange={(e) => setClassification(e.target.value)}
              className="h-4 w-4 text-me-red focus:ring-me-red"
            />
            <span className="ml-2 text-sm text-me-grey-dark">ユニット図</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="classification"
              value="部品図"
              checked={classification === '部品図'}
              onChange={(e) => setClassification(e.target.value)}
              className="h-4 w-4 text-me-red focus:ring-me-red"
            />
            <span className="ml-2 text-sm text-me-grey-dark">部品図</span>
          </label>
        </div>
      </div>

      {/* ファイル名検索 */}
      <div>
        <h3 className="text-sm font-medium text-me-grey-dark mb-2">ファイル名検索</h3>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ファイル名を入力..."
          className="w-full px-3 py-2 border border-me-grey-medium rounded-me focus:ring-me-red focus:border-me-red"
        />
      </div>

      {/* タグフィルタ */}
      <div>
        <h3 className="text-sm font-medium text-me-grey-dark mb-2">タグ</h3>
        {availableTags.length === 0 ? (
          <p className="text-xs text-me-grey-medium">タグがありません</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {availableTags.map((tag) => (
              <label key={tag} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={() => handleTagToggle(tag)}
                  className="h-4 w-4 text-me-red focus:ring-me-red rounded-me"
                />
                <span className="ml-2 text-sm text-me-grey-dark">{tag}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 適用ボタン */}
      <div className="pt-4 border-t border-me-grey-medium">
        <button
          onClick={handleApply}
          className="w-full px-4 py-3 bg-[#FF0000] text-white rounded-me hover:bg-[#FF3333] transition-colors font-medium"
        >
          フィルタを適用
        </button>
      </div>

      {/* 現在の選択表示 */}
      {(classification || search || selectedTags.length > 0) && (
        <div className="pt-4 border-t border-me-grey-medium">
          <h3 className="text-sm font-medium text-me-grey-dark mb-2">
            現在の選択
          </h3>
          <div className="space-y-1">
            {classification && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-me-grey-dark">分類: {classification}</span>
                <button
                  onClick={() => setClassification('')}
                  className="text-me-red hover:text-primary-600"
                >
                  ×
                </button>
              </div>
            )}
            {search && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-me-grey-dark truncate">検索: {search}</span>
                <button
                  onClick={() => setSearch('')}
                  className="text-me-red hover:text-primary-600"
                >
                  ×
                </button>
              </div>
            )}
            {selectedTags.map((tag) => (
              <div key={tag} className="flex items-center justify-between text-xs">
                <span className="text-me-grey-dark">タグ: {tag}</span>
                <button
                  onClick={() => handleTagToggle(tag)}
                  className="text-me-red hover:text-primary-600"
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
