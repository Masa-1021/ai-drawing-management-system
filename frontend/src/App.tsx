/**
 * メインアプリケーション
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Pages
import UploadPage from './pages/UploadPage';
import ListPage from './pages/ListPage';
import EditPage from './pages/EditPage';
import SearchPage from './pages/SearchPage';
import NotFoundPage from './pages/NotFoundPage';

// Layout
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/upload" replace />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/list" element={<ListPage />} />
          <Route path="/edit/:id" element={<EditPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>

      {/* Toast通知 */}
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

export default App;
