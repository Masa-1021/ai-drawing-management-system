/**
 * 検索ページ
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { searchApi } from '../api/search';
import type { Drawing } from '../types/drawing';

export default function SearchPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'natural' | 'similar'>('natural');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Drawing[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleNaturalSearch = async () => {
    if (!query.trim()) {
      toast.error('検索クエリを入力してください');
      return;
    }

    try {
      setIsSearching(true);
      const drawings = await searchApi.naturalLanguageSearch(query);
      setResults(drawings);
      toast.success(`${drawings.length}件の図面が見つかりました`);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('検索に失敗しました');
    } finally {
      setIsSearching(false);
    }
  };

  const searchExamples = [
    '作成者が田中の図面',
    '2024年1月以降の組図',
    '材質がSS400の部品図',
    'ステータスが承認済みの図面',
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">検索</h1>

      {/* タブ */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('natural')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'natural'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            自然言語検索
          </button>
          <button
            onClick={() => setActiveTab('similar')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'similar'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            類似検索
          </button>
        </nav>
      </div>

      {/* 自然言語検索 */}
      {activeTab === 'natural' && (
        <div className="space-y-6">
          {/* 検索フォーム */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">自然言語で検索</h3>

            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNaturalSearch()}
                  placeholder="例: 作成者が田中の図面"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleNaturalSearch}
                disabled={isSearching}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isSearching ? '検索中...' : '検索'}
              </button>
            </div>

            {/* 検索例 */}
            <div className="mt-6">
              <p className="text-sm text-gray-600 mb-2">検索例:</p>
              <div className="flex flex-wrap gap-2">
                {searchExamples.map((example) => (
                  <button
                    key={example}
                    onClick={() => setQuery(example)}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 検索結果 */}
          {results.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4">
                検索結果 ({results.length}件)
              </h3>

              <div className="space-y-3">
                {results.map((drawing) => (
                  <div
                    key={drawing.id}
                    className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                    onClick={() => navigate(`/edit/${drawing.id}`)}
                  >
                    <div>
                      <h4 className="font-medium">{drawing.pdf_filename}</h4>
                      <p className="text-sm text-gray-600">
                        {drawing.classification || '未分類'} | {drawing.created_by}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded ${
                        drawing.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {drawing.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 類似検索 */}
      {activeTab === 'similar' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">類似検索</h3>
          <p className="text-gray-600">
            図面編集画面から「類似図面を検索」ボタンをクリックして使用してください
          </p>
        </div>
      )}
    </div>
  );
}
