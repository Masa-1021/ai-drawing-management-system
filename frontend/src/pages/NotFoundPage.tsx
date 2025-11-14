/**
 * 404ページ
 */

import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="text-center py-12">
      <h1 className="text-6xl font-bold text-gray-900">404</h1>
      <p className="mt-4 text-xl text-gray-600">ページが見つかりません</p>
      <Link
        to="/"
        className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        ホームに戻る
      </Link>
    </div>
  );
}
