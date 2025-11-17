/**
 * 404ページ
 */

import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="text-center py-12">
      <h1 className="text-6xl font-bold text-me-grey-deep">404</h1>
      <p className="mt-4 text-xl text-me-grey-dark">ページが見つかりません</p>
      <Link
        to="/"
        className="mt-6 inline-block px-6 py-3 bg-[#FF0000] text-white rounded-me hover:bg-[#FF3333] font-medium"
      >
        ホームに戻る
      </Link>
    </div>
  );
}
