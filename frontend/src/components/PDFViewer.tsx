/**
 * PDFビューアーコンポーネント
 */

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js Workerの設定
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  pdfUrl: string;
  pageNumber?: number;
  onPageChange?: (page: number) => void;
  aiRotation?: number; // AIで検出された回転角度 (0, 90, 180, 270)
  focusArea?: { x: number; y: number; width: number; height: number } | null; // ズーム対象領域
}

export default function PDFViewer({
  pdfUrl,
  pageNumber = 1,
  onPageChange,
  aiRotation = 0,
  focusArea = null,
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(pageNumber);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // ドラッグ移動用の状態
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });

  // PDFを読み込み
  useEffect(() => {
    const loadPdf = async () => {
      try {
        // 相対URLを絶対URLに変換（PDF.jsは相対URLを正しく解決できない場合がある）
        const absoluteUrl = pdfUrl.startsWith('/') ? `${window.location.origin}${pdfUrl}` : pdfUrl;
        console.log('[DEBUG] PDFViewer loading PDF from:', absoluteUrl);
        setIsLoading(true);
        const loadingTask = pdfjsLib.getDocument(absoluteUrl);
        const pdfDoc = await loadingTask.promise;
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
        console.log('[DEBUG] PDF loaded successfully, pages:', pdfDoc.numPages);
        setIsLoading(false);
      } catch (error) {
        console.error('[ERROR] PDF load error:', error);
        console.error('[ERROR] Failed URL:', pdfUrl);
        setIsLoading(false);
      }
    };

    loadPdf();
  }, [pdfUrl]);

  // ページを描画
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    let currentRenderTask: pdfjsLib.RenderTask | null = null;
    let isCancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas || isCancelled) return;

        const context = canvas.getContext('2d');
        if (!context || isCancelled) return;

        // 既存のレンダリングタスクをキャンセル
        if (currentRenderTask) {
          currentRenderTask.cancel();
          currentRenderTask = null;
        }

        // PDF.jsのデフォルト動作ではPDFメタデータの回転が自動適用されるが、
        // これを無効化してAIで検出した回転角度のみを使用する

        // AIが返す値は「PDFを正しい向きにするために必要な回転角度」
        // PDF.jsのviewportのrotationパラメータはそのまま適用される
        // 例：AIが90度と返した場合、PDF.jsで90度回転させると正しい向きになる
        const correctionRotation = aiRotation;

        // 最終的な回転 = AI補正回転 + ユーザー設定の回転
        const finalRotation = correctionRotation + rotation;

        const viewport = page.getViewport({ scale, rotation: finalRotation });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        if (isCancelled) return;

        currentRenderTask = page.render(renderContext);
        await currentRenderTask.promise;
        currentRenderTask = null;
      } catch (error: unknown) {
        // RenderingCancelledExceptionは無視
        if (error && typeof error === 'object' && 'name' in error && error.name === 'RenderingCancelledException') {
          return;
        }
        if (!isCancelled) {
          console.error('Page render error:', error);
        }
      }
    };

    renderPage();

    // クリーンアップ時にレンダリングタスクをキャンセル
    return () => {
      isCancelled = true;
      if (currentRenderTask) {
        currentRenderTask.cancel();
        currentRenderTask = null;
      }
    };
  }, [pdf, currentPage, scale, rotation, aiRotation]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      onPageChange?.(newPage);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      onPageChange?.(newPage);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleFitToWidth = () => {
    if (canvasRef.current) {
      const containerWidth = canvasRef.current.parentElement?.clientWidth || 800;
      setScale(containerWidth / canvasRef.current.width);
    }
  };

  // ドラッグ開始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setScrollStart({
      x: containerRef.current.scrollLeft,
      y: containerRef.current.scrollTop,
    });
  };

  // ドラッグ中
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    containerRef.current.scrollLeft = scrollStart.x - dx;
    containerRef.current.scrollTop = scrollStart.y - dy;
  };

  // ドラッグ終了
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // マウスがコンテナ外に出た場合もドラッグ終了
  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // 風船クリック時のズーム・パン処理
  // バックエンドで回転補正後の画像から風船座標を取得しているため、
  // フロントエンドでは座標変換不要
  useEffect(() => {
    if (!focusArea || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // 風船領域を画面に収めるためのズーム倍率を計算
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // 風船領域に余白を追加（2倍に拡大して見やすく）
    const padding = 2.0;
    const targetWidth = focusArea.width * padding;
    const targetHeight = focusArea.height * padding;

    // コンテナに収まるスケールを計算
    const scaleX = containerWidth / targetWidth;
    const scaleY = containerHeight / targetHeight;
    const newScale = Math.min(scaleX, scaleY, 3.0); // 最大3倍まで

    setScale(newScale);

    // スケール設定後、少し待ってからスクロール位置を調整
    setTimeout(() => {
      if (!canvas || !container) return;

      // 風船の中心座標を計算
      const centerX = focusArea.x + focusArea.width / 2;
      const centerY = focusArea.y + focusArea.height / 2;

      // キャンバス上の実際のピクセル位置
      const scrollX = centerX * newScale - containerWidth / 2;
      const scrollY = centerY * newScale - containerHeight / 2;

      // スクロール
      container.scrollTo({
        left: Math.max(0, scrollX),
        top: Math.max(0, scrollY),
        behavior: 'smooth',
      });
    }, 100);
  }, [focusArea]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-me-grey-light rounded-me">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-me-red mx-auto"></div>
          <p className="mt-4 text-sm text-me-grey-dark">PDF読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* コントロールバー */}
      <div className="flex items-center justify-between bg-white border border-me-grey-medium rounded-me p-3">
        {/* ページコントロール */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-me-grey-light rounded-me hover:bg-me-grey-medium disabled:opacity-50 disabled:cursor-not-allowed text-me-grey-dark"
          >
            &lt;
          </button>
          <span className="text-sm text-me-grey-dark">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-me-grey-light rounded-me hover:bg-me-grey-medium disabled:opacity-50 disabled:cursor-not-allowed text-me-grey-dark"
          >
            &gt;
          </button>
        </div>

        {/* ズームコントロール */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomOut}
            className="px-3 py-1 bg-me-grey-light rounded-me hover:bg-me-grey-medium text-me-grey-dark"
          >
            -
          </button>
          <span className="text-sm text-me-grey-dark">{Math.round(scale * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="px-3 py-1 bg-me-grey-light rounded-me hover:bg-me-grey-medium text-me-grey-dark"
          >
            +
          </button>
          <button
            onClick={handleFitToWidth}
            className="px-3 py-1 bg-me-grey-light rounded-me hover:bg-me-grey-medium text-sm text-me-grey-dark"
          >
            幅に合わせる
          </button>
        </div>

        {/* 回転 */}
        <div>
          <button
            onClick={handleRotate}
            className="px-3 py-1 bg-me-grey-light rounded-me hover:bg-me-grey-medium text-me-grey-dark"
          >
            回転
          </button>
        </div>
      </div>

      {/* PDFキャンバス */}
      <div
        ref={containerRef}
        className="bg-me-grey-light rounded-me overflow-auto"
        style={{
          maxHeight: '800px',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <canvas ref={canvasRef} className="mx-auto pointer-events-none" />
      </div>
    </div>
  );
}
