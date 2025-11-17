/**
 * アップロードページ
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { drawingsApi } from '../api/drawings';
import { useDrawingStore } from '../stores/drawingStore';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const { addDrawing, setLoading } = useDrawingStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (level: LogEntry['level'], message: string) => {
    const timestamp = new Date().toLocaleTimeString('ja-JP');
    setLogs((prev) => [...prev, { timestamp, level, message }]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleFileSelect = async (files: FileList | null) => {
    console.log('[DEBUG] handleFileSelect called:', files);

    if (!files || files.length === 0) {
      console.log('[DEBUG] No files selected or FileList empty');
      return;
    }

    const file = files[0];
    console.log('[DEBUG] File:', file);

    // バリデーション
    if (!file.name.endsWith('.pdf')) {
      console.log('[DEBUG] File validation failed: not a PDF');
      toast.error('PDFファイルのみアップロード可能です');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      console.log('[DEBUG] File validation failed: over 50MB');
      toast.error('ファイルサイズは50MB以下にしてください');
      return;
    }

    // アップロード
    try {
      clearLogs();
      addLog('info', `ファイルを選択しました: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      console.log('[DEBUG] Upload start');
      setIsUploading(true);
      setLoading(true);
      addLog('info', 'PDFファイルをサーバーにアップロード中...');
      addLog('info', 'PDF回転を自動検出・修正中...');
      addLog('info', 'サムネイルを生成中...');
      addLog('info', 'AI解析を実行中（図面情報を自動抽出）...');

      console.log('[DEBUG] Call drawingsApi.upload');
      const drawings = await drawingsApi.upload(file, true);

      console.log('[DEBUG] Upload succeeded:', drawings);
      addLog('success', `アップロード完了: ${drawings.length}ページの図面を処理しました`);

      // ストアに追加
      drawings.forEach((drawing, idx) => {
        console.log(`[DEBUG] addDrawing idx=${idx}:`, drawing);
        addDrawing(drawing);
        addLog('info', `図面 ${idx + 1}/${drawings.length}: ${drawing.pdf_filename} を登録しました`);
      });

      toast.success(`${drawings.length}ページの図面をアップロードしました`);
      addLog('success', '全ての処理が完了しました。一覧ページに移動します...');

      // 一覧ページに遷移
      setTimeout(() => {
        console.log('[DEBUG] Navigate to /list');
        navigate('/list');
      }, 1000);
    } catch (error) {
      console.error('[ERROR] Upload error:', error);

      if (
        error &&
        typeof error === 'object' &&
        error !== null &&
        'response' in error
      ) {
        // @ts-ignore
        console.log('[ERROR] Axios error response:', error.response);
        // @ts-ignore
        const errorMessage = error.response?.data?.detail || 'アップロードに失敗しました';
        addLog('error', `エラー: ${errorMessage}`);
      } else {
        addLog('error', `エラー: ${error}`);
      }

      toast.error('アップロードに失敗しました');
    } finally {
      console.log('[DEBUG] Upload finished - cleaning up');
      setIsUploading(false);
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-me-grey-deep">図面アップロード</h1>
        <p className="mt-2 text-sm text-me-grey-dark">
          PDFファイルをドラッグ&ドロップ、またはクリックして選択してください
        </p>
      </div>

      {/* ドロップエリア */}
      <div
        className={`relative border-2 border-dashed rounded-me p-12 text-center transition-colors ${
          isDragging
            ? 'border-me-red bg-me-grey-light'
            : 'border-me-grey-medium hover:border-me-red'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".pdf"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={isUploading}
        />

        <div className="space-y-4">
          <svg
            className="mx-auto h-12 w-12 text-me-grey-medium"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div className="text-sm text-me-grey-dark">
            <span className="font-medium text-me-red">ファイルを選択</span>
            <span className="ml-1">またはドラッグ&ドロップ</span>
          </div>

          <p className="text-xs text-me-grey-medium">PDF (最大50MB)</p>
        </div>
      </div>

      {/* 操作ログ */}
      {logs.length > 0 && (
        <div className="bg-white border border-me-grey-medium rounded-me p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-me-grey-deep">操作ログ</h2>
            <button
              onClick={clearLogs}
              className="text-sm text-me-grey-dark hover:text-me-grey-deep"
            >
              クリア
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`flex items-start space-x-3 text-sm p-2 rounded-me ${
                  log.level === 'error'
                    ? 'bg-me-red text-white'
                    : log.level === 'success'
                    ? 'bg-me-grey-light text-me-grey-dark border border-me-grey-medium'
                    : log.level === 'warning'
                    ? 'bg-me-grey-light text-me-grey-dark border border-me-grey-medium'
                    : 'bg-me-grey-light text-me-grey-dark'
                }`}
              >
                <span className="font-mono text-xs text-me-grey-medium whitespace-nowrap">
                  {log.timestamp}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-me text-xs font-medium ${
                    log.level === 'error'
                      ? 'bg-white text-me-red'
                      : log.level === 'success'
                      ? 'bg-me-grey-medium text-me-grey-dark'
                      : log.level === 'warning'
                      ? 'bg-me-grey-medium text-me-grey-dark'
                      : 'bg-me-grey-medium text-me-grey-dark'
                  }`}
                >
                  {log.level.toUpperCase()}
                </span>
                <span className="flex-1">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
