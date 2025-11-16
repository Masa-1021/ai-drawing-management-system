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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
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

      console.log('[DEBUG] Upload start: setUploadProgress(0)');
      setIsUploading(true);
      setLoading(true);
      setUploadProgress(0);
      setUploadStatus('PDFファイルをアップロード中...');
      addLog('info', 'PDFファイルをサーバーにアップロード中...');

      // 少し待機してUIを更新
      await new Promise(resolve => setTimeout(resolve, 100));
      setUploadProgress(10);
      setUploadStatus('PDF回転を検出・修正中...');
      addLog('info', 'PDF回転を自動検出・修正中...');

      await new Promise(resolve => setTimeout(resolve, 100));
      setUploadProgress(20);
      setUploadStatus('サムネイルを生成中...');
      addLog('info', 'サムネイルを生成中...');

      await new Promise(resolve => setTimeout(resolve, 100));
      setUploadProgress(30);
      setUploadStatus('AI解析を実行中...');
      addLog('info', 'AI解析を実行中（図面情報を自動抽出）...');

      console.log('[DEBUG] Call drawingsApi.upload');
      const drawings = await drawingsApi.upload(file, true);

      console.log('[DEBUG] Upload succeeded:', drawings);
      addLog('success', `アップロード完了: ${drawings.length}ページの図面を処理しました`);

      setUploadProgress(90);
      setUploadStatus('アップロード完了！');

      // ストアに追加
      drawings.forEach((drawing, idx) => {
        console.log(`[DEBUG] addDrawing idx=${idx}:`, drawing);
        addDrawing(drawing);
        addLog('info', `図面 ${idx + 1}/${drawings.length}: ${drawing.pdf_filename} を登録しました`);
      });

      toast.success(`${drawings.length}ページの図面をアップロードしました`);
      setUploadProgress(100);
      setUploadStatus('処理完了');
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
      setUploadProgress(0);
      setUploadStatus('');
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
        <h1 className="text-3xl font-bold text-gray-900">図面アップロード</h1>
        <p className="mt-2 text-sm text-gray-600">
          PDFファイルをドラッグ&ドロップ、またはクリックして選択してください
        </p>
      </div>

      {/* ドロップエリア */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
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
            className="mx-auto h-12 w-12 text-gray-400"
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

          <div className="text-sm text-gray-600">
            <span className="font-medium text-blue-600">ファイルを選択</span>
            <span className="ml-1">またはドラッグ&ドロップ</span>
          </div>

          <p className="text-xs text-gray-500">PDF (最大50MB)</p>
        </div>

        {/* アップロード進捗 */}
        {isUploading && (
          <div className="mt-6 space-y-3">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-in-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">{uploadStatus}</p>
              <p className="text-sm text-gray-500">{uploadProgress}%</p>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>• PDFの回転を自動検出・修正しています</p>
              <p>• AI解析により図面情報を自動抽出しています</p>
              <p>• この処理には数分かかることがあります</p>
            </div>
          </div>
        )}
      </div>

      {/* 操作ログ */}
      {logs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-900">操作ログ</h2>
            <button
              onClick={clearLogs}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              クリア
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`flex items-start space-x-3 text-sm p-2 rounded ${
                  log.level === 'error'
                    ? 'bg-red-50 text-red-700'
                    : log.level === 'success'
                    ? 'bg-green-50 text-green-700'
                    : log.level === 'warning'
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-gray-50 text-gray-700'
                }`}
              >
                <span className="font-mono text-xs text-gray-500 whitespace-nowrap">
                  {log.timestamp}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    log.level === 'error'
                      ? 'bg-red-100 text-red-800'
                      : log.level === 'success'
                      ? 'bg-green-100 text-green-800'
                      : log.level === 'warning'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
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
