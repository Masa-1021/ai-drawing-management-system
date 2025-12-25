/**
 * アップロードページ
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { drawingsApi } from '../api/drawings';
import { useDrawingStore } from '../stores/drawingStore';
import { websocketClient } from '../lib/websocket';
import { checkAIStatus, AIStatusResponse, startSSOAuth, completeSSOAuth } from '../api/client';

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
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // AI接続状態
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);
  const [isCheckingAI, setIsCheckingAI] = useState(true);
  const [isStartingSSOAuth, setIsStartingSSOAuth] = useState(false);

  const addLog = (level: LogEntry['level'], message: string) => {
    const timestamp = new Date().toLocaleTimeString('ja-JP');
    setLogs((prev) => [...prev, { timestamp, level, message }]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  // AI接続状態をチェック
  useEffect(() => {
    const checkStatus = async () => {
      setIsCheckingAI(true);
      // checkAIStatusは内部でエラーをキャッチし、常にAIStatusResponseを返す
      const status = await checkAIStatus();
      setAiStatus(status);
      setIsCheckingAI(false);
    };

    checkStatus();
  }, []);

  // AI接続状態を再チェック
  const handleRetryAICheck = async () => {
    setIsCheckingAI(true);
    // checkAIStatusは内部でエラーをキャッチし、常にAIStatusResponseを返す
    const status = await checkAIStatus();
    setAiStatus(status);
    if (status.status === 'ok') {
      toast.success('AI接続が復旧しました');
    } else if (status.status === 'error') {
      toast.error('AI接続エラーが続いています');
    }
    setIsCheckingAI(false);
  };

  // AWS SSO認証を開始（ブラウザで認証ページを開く）
  const handleStartSSOAuth = async () => {
    setIsStartingSSOAuth(true);
    try {
      const result = await startSSOAuth();
      if (result.status === 'ok' && result.verification_uri) {
        // 認証URLを新しいタブで開く
        window.open(result.verification_uri, '_blank');
        toast.success(
          `認証ページを開きました。認証後、自動的にトークンを取得します。`,
          { duration: 10000 }
        );

        // トークン取得のためのポーリング開始
        const deviceCode = result.device_code!;
        const clientId = result.client_id!;
        const clientSecret = result.client_secret!;
        const expiresIn = result.expires_in || 600;
        const startTime = Date.now();
        const pollInterval = 5000; // 5秒間隔

        const pollForCompletion = async () => {
          // 有効期限チェック
          if (Date.now() - startTime > expiresIn * 1000) {
            toast.error('認証の有効期限が切れました。再度お試しください。');
            setIsStartingSSOAuth(false);
            return;
          }

          const completeResult = await completeSSOAuth(deviceCode, clientId, clientSecret);

          if (completeResult.status === 'ok') {
            toast.success('認証が完了しました！');
            setIsStartingSSOAuth(false);
            // 接続状態を再チェック
            handleRetryAICheck();
          } else if (completeResult.status === 'pending') {
            // まだ認証待ち - 続行
            setTimeout(pollForCompletion, pollInterval);
          } else {
            // エラー
            toast.error(completeResult.message || 'トークン取得に失敗しました');
            setIsStartingSSOAuth(false);
          }
        };

        // 最初のポーリングを開始（3秒後）
        setTimeout(pollForCompletion, 3000);
      } else {
        toast.error(result.message || 'SSO認証の開始に失敗しました');
        setIsStartingSSOAuth(false);
      }
    } catch {
      toast.error('SSO認証の開始に失敗しました');
      setIsStartingSSOAuth(false);
    }
  };

  // WebSocket進捗通知を購読
  useEffect(() => {
    console.log('[UploadPage] useEffect: subscribing to upload progress');
    const handleProgress = (data: { message: string; level: 'info' | 'success' | 'error' | 'warning' }) => {
      console.log('[UploadPage] handleProgress called:', data);
      addLog(data.level, data.message);
    };

    websocketClient.subscribeUploadProgress(handleProgress);
    console.log('[UploadPage] subscribed, isConnected:', websocketClient.isConnected());

    return () => {
      console.log('[UploadPage] useEffect cleanup: unsubscribing');
      websocketClient.unsubscribeUploadProgress(handleProgress);
    };
  }, []);

  // ファイル選択のバリデーション
  const validateAndSetFiles = (files: FileList | null): boolean => {
    console.log('[DEBUG] validateAndSetFiles called:', files);

    if (!files || files.length === 0) {
      console.log('[DEBUG] No files selected or FileList empty');
      return false;
    }

    const fileArray = Array.from(files);
    console.log('[DEBUG] Number of files:', fileArray.length);

    for (const file of fileArray) {
      const isValidFile = file.name.endsWith('.pdf') ||
                          file.name.endsWith('.tif') ||
                          file.name.endsWith('.tiff');

      if (!isValidFile) {
        console.log('[DEBUG] File validation failed: not a PDF or TIF -', file.name);
        toast.error(`PDFまたはTIFファイルのみアップロード可能です: ${file.name}`);
        return false;
      }

      if (file.size > 50 * 1024 * 1024) {
        console.log('[DEBUG] File validation failed: over 50MB -', file.name);
        toast.error(`ファイルサイズは50MB以下にしてください: ${file.name}`);
        return false;
      }
    }

    setSelectedFiles(fileArray);
    clearLogs();

    const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);
    addLog('info', `${fileArray.length}個のファイルを選択しました (合計 ${(totalSize / 1024 / 1024).toFixed(2)}MB)`);
    fileArray.forEach((file, index) => {
      addLog('info', `  ${index + 1}. ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    });

    return true;
  };

  // ファイル選択をクリア
  const clearSelectedFiles = () => {
    setSelectedFiles([]);
    clearLogs();
  };

  // アップロード実行
  const handleUpload = async (runAnalysis: boolean) => {
    if (selectedFiles.length === 0) {
      toast.error('ファイルを選択してください');
      return;
    }

    let progressInterval: ReturnType<typeof setInterval> | null = null;
    try {
      console.log('[DEBUG] Upload start, runAnalysis:', runAnalysis);
      setIsUploading(true);
      setLoading(true);

      const startTime = Date.now();
      if (runAnalysis) {
        addLog('info', 'PDFファイルをサーバーにアップロード中（AI解析あり）...');
      } else {
        addLog('info', 'PDFファイルをサーバーにアップロード中（解析スキップ）...');
      }

      progressInterval = setInterval(() => {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        setElapsedTime(seconds);
      }, 1000);

      console.log('[DEBUG] Call drawingsApi.upload');
      const drawings = await drawingsApi.upload(selectedFiles, runAnalysis);

      if (progressInterval) clearInterval(progressInterval);
      setElapsedTime(null);

      console.log('[DEBUG] Upload succeeded:', drawings);
      addLog('success', `アップロード完了: ${drawings.length}ページの図面を処理しました`);

      drawings.forEach((drawing, idx) => {
        console.log(`[DEBUG] addDrawing idx=${idx}:`, drawing);
        addDrawing(drawing);
        addLog('info', `図面 ${idx + 1}/${drawings.length}: ${drawing.pdf_filename} を登録しました`);
      });

      toast.success(`${selectedFiles.length}個のファイル、${drawings.length}ページの図面をアップロードしました`);
      addLog('success', '全ての処理が完了しました。一覧画面に遷移します...');

      setSelectedFiles([]);

      setTimeout(() => {
        navigate('/list');
      }, 1500);
    } catch (error) {
      console.error('[ERROR] Upload error:', error);

      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setElapsedTime(null);

      let errorMessage = 'アップロードに失敗しました';

      if (
        error &&
        typeof error === 'object' &&
        error !== null &&
        'response' in error
      ) {
        // @ts-ignore
        console.log('[ERROR] Axios error response:', error.response);
        // @ts-ignore
        const detail = error.response?.data?.detail;
        if (Array.isArray(detail)) {
          errorMessage = detail.map((d: { msg?: string; type?: string }) => d.msg || d.type || '不明なエラー').join(', ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        } else {
          // @ts-ignore
          errorMessage = error.message || 'アップロードに失敗しました';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = JSON.stringify(error);
      }

      addLog('error', `エラー: ${errorMessage}`);
      toast.error(errorMessage);
    } finally {
      console.log('[DEBUG] Upload finished - cleaning up');
      setIsUploading(false);
      setLoading(false);
    }
  };

  // レガシー: ドラッグ&ドロップからの直接アップロード（互換性のため維持）
  const handleFileSelect = (files: FileList | null) => {
    validateAndSetFiles(files);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-me-grey-deep">図面アップロード</h1>
        <p className="mt-2 text-sm text-me-grey-dark">
          PDFファイルをドラッグ&ドロップ、またはクリックして選択してください
        </p>
      </div>

      {/* AI接続状態 */}
      {isCheckingAI ? (
        <div className="bg-blue-50 border border-blue-200 rounded-me p-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-blue-800">AI接続状態を確認中...</span>
          </div>
        </div>
      ) : aiStatus?.status === 'error' ? (
        <div className="bg-red-50 border border-red-300 rounded-me p-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-red-800 text-sm">AI接続エラー（AWS認証切れ）</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleStartSSOAuth}
                disabled={isStartingSSOAuth}
                className="px-3 py-1 bg-gray-700 text-green-400 rounded-me hover:bg-gray-600 disabled:opacity-50 text-sm font-mono"
                title="クリックでAWS SSO認証を開始"
              >
                {isStartingSSOAuth ? '認証開始中...' : 'aws sso login'}
              </button>
              <button
                onClick={handleRetryAICheck}
                disabled={isCheckingAI}
                className="px-3 py-1 bg-me-red text-white rounded-me hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                {isCheckingAI ? '確認中...' : '再確認'}
              </button>
            </div>
          </div>
        </div>
      ) : aiStatus?.status === 'ok' ? (
        <div className="bg-green-50 border border-green-200 rounded-me p-4">
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-800">{aiStatus.message}</span>
          </div>
        </div>
      ) : null}

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
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFileSelect(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          accept=".pdf,.tif,.tiff"
          multiple
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
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

          <p className="text-xs text-me-grey-medium">PDF / TIF (複数選択可、各ファイル最大50MB)</p>
        </div>
      </div>

      {/* アップロードボタン */}
      {selectedFiles.length > 0 && !isUploading && (
        <div className="bg-white border border-me-grey-medium rounded-me p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-me-grey-deep">
              {selectedFiles.length}個のファイルが選択されています
            </h3>
            <button
              onClick={clearSelectedFiles}
              className="text-sm text-me-grey-dark hover:text-me-red"
            >
              クリア
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {/* AI解析付きアップロード */}
            <button
              onClick={() => handleUpload(true)}
              disabled={aiStatus?.status === 'error'}
              className={`flex-1 px-6 py-4 rounded-me font-medium transition-colors ${
                aiStatus?.status === 'error'
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-me-red text-white hover:bg-red-700'
              }`}
            >
              <div className="flex flex-col items-center">
                <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-base">アップロード</span>
                <span className="text-xs mt-1 opacity-80">AI自動解析あり</span>
              </div>
            </button>

            {/* マニュアルアップロード（AI解析なし） */}
            <button
              onClick={() => handleUpload(false)}
              className={`flex-1 px-6 py-4 rounded-me font-medium transition-colors ${
                aiStatus?.status === 'error'
                  ? 'bg-me-red text-white hover:bg-red-700 ring-2 ring-offset-2 ring-me-red'
                  : 'bg-me-grey-dark text-white hover:bg-me-grey-deep'
              }`}
            >
              <div className="flex flex-col items-center">
                <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-base">高速アップロード</span>
                <span className="text-xs mt-1 opacity-80">AI解析スキップ</span>
              </div>
            </button>
          </div>

          {aiStatus?.status === 'error' && (
            <p className="mt-2 text-sm text-amber-700">
              ※ AI解析なしでアップロード可能です
            </p>
          )}
        </div>
      )}

      {/* 操作ログ */}
      {logs.length > 0 && (
        <div className="bg-white border border-me-grey-medium rounded-me p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-me-grey-deep">処理ログ</h2>
              {elapsedTime !== null && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium animate-pulse">
                  処理中... {elapsedTime}秒
                </span>
              )}
            </div>
            <button
              onClick={clearLogs}
              className="text-sm text-me-grey-dark hover:text-me-grey-deep"
            >
              クリア
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {[...logs]
              .filter((log) => !log.message.includes('【DEBUG】'))
              .reverse()
              .map((log, index) => {
              // ステップ表示（[1/6] など）かどうかを判定
              const isStepMessage = log.message.match(/^\[\d+\/\d+\]/);
              const isCompleted = log.message.includes('完了');
              const isStarting = log.message.includes('開始');

              return (
                <div
                  key={index}
                  className={`flex items-start space-x-3 text-sm p-2 rounded-me ${
                    log.level === 'error'
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : log.level === 'success' && isStepMessage
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : log.level === 'success'
                      ? 'bg-blue-50 text-blue-800 border border-blue-200'
                      : log.level === 'warning'
                      ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                      : isStepMessage && isStarting
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-me-grey-light text-me-grey-dark'
                  }`}
                >
                  <span className="font-mono text-xs text-me-grey-medium whitespace-nowrap">
                    {log.timestamp}
                  </span>
                  {isStepMessage ? (
                    <span
                      className={`px-2 py-0.5 rounded-me text-xs font-bold ${
                        isCompleted
                          ? 'bg-green-600 text-white'
                          : isStarting
                          ? 'bg-amber-500 text-white animate-pulse'
                          : 'bg-gray-500 text-white'
                      }`}
                    >
                      {log.message.match(/^\[\d+\/\d+\]/)?.[0] || 'STEP'}
                    </span>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-me text-xs font-medium ${
                        log.level === 'error'
                          ? 'bg-red-600 text-white'
                          : log.level === 'success'
                          ? 'bg-blue-600 text-white'
                          : log.level === 'warning'
                          ? 'bg-yellow-600 text-white'
                          : 'bg-me-grey-medium text-me-grey-dark'
                      }`}
                    >
                      {log.level.toUpperCase()}
                    </span>
                  )}
                  <span className="flex-1">
                    {isStepMessage
                      ? log.message.replace(/^\[\d+\/\d+\]\s*/, '')
                      : log.message}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
