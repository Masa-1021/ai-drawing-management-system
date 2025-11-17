/**
 * レイアウトコンポーネント
 */

import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: '/upload', label: 'アップロード' },
    { path: '/list', label: '図面一覧' },
    { path: '/search', label: '検索' },
  ];

  return (
    <div className="min-h-screen bg-me-grey-light">
      {/* ヘッダー */}
      <header className="bg-white border-b border-me-grey-medium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* ロゴ */}
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-me-red">
                CAD Drawing Manager
              </Link>
            </div>

            {/* ナビゲーション */}
            <nav className="flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-me text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-[#FF0000] text-white'
                      : 'bg-white text-[#333333] border border-[#C4C4C4] hover:bg-[#F2F2F2]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>

      {/* フッター */}
      <footer className="bg-white border-t border-me-grey-medium mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-me-grey-dark">
            © 2024 CAD Drawing Manager. Powered by Claude AI.
          </p>
        </div>
      </footer>
    </div>
  );
}
