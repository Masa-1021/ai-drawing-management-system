/**
 * メインアプリケーション
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Pages
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import ListPage from './pages/ListPage';
import EditPage from './pages/EditPage';
import SearchPage from './pages/SearchPage';
import EquipmentListPage from './pages/EquipmentListPage';
import { EquipmentDetailPage } from './pages/EquipmentDetailPage';
import { SpecSheetListPage } from './pages/SpecSheetListPage';
import { SpecSheetDetailPage } from './pages/SpecSheetDetailPage';
import { SpecNumberListPage } from './pages/SpecNumberListPage';
import { PromptSettingsPage } from './pages/PromptSettingsPage';
import NotFoundPage from './pages/NotFoundPage';

// Layout
import Layout from './components/Layout';

// API
import { AWS_AUTH_ERROR_EVENT } from './api/client';

// React Query Client
const queryClient = new QueryClient();

function App() {
  // AWS認証エラーイベントを監視
  useEffect(() => {
    const handleAWSAuthError = (event: CustomEvent<{ message: string }>) => {
      toast.error(event.detail.message, {
        duration: 10000, // 10秒間表示
        style: {
          background: '#FEE2E2',
          color: '#991B1B',
          border: '1px solid #F87171',
        },
        icon: '🔐',
      });
    };

    window.addEventListener(AWS_AUTH_ERROR_EVENT, handleAWSAuthError as EventListener);
    return () => {
      window.removeEventListener(AWS_AUTH_ERROR_EVENT, handleAWSAuthError as EventListener);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* ホームページ */}
          <Route path="/" element={<Layout><HomePage /></Layout>} />
          <Route path="/upload" element={<Layout><UploadPage /></Layout>} />
          <Route path="/list" element={<Layout><ListPage /></Layout>} />
          <Route path="/edit/:id" element={<Layout><EditPage /></Layout>} />
          <Route path="/search" element={<Layout><SearchPage /></Layout>} />
          <Route path="/equipment" element={<Layout><EquipmentListPage /></Layout>} />

          {/* 全幅レイアウト */}
          <Route path="/equipment/:id" element={<Layout fullWidth><EquipmentDetailPage /></Layout>} />
          <Route path="/spec-sheets" element={<Layout fullWidth><SpecSheetListPage /></Layout>} />
          <Route path="/spec-sheets/:id" element={<Layout fullWidth><SpecSheetDetailPage /></Layout>} />
          <Route path="/spec-numbers" element={<Layout fullWidth><SpecNumberListPage /></Layout>} />

          {/* プロンプト設定 */}
          <Route path="/prompts" element={<Layout><PromptSettingsPage /></Layout>} />

          <Route path="*" element={<Layout><NotFoundPage /></Layout>} />
        </Routes>

        {/* Toast通知 */}
        <Toaster position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
