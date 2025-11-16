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
}

export default function PDFViewer({
  pdfUrl,
  pageNumber = 1,
  onPageChange,
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(pageNumber);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // PDFを読み込み
  useEffect(() => {
    const loadPdf = async () => {
      try {
        console.log('[DEBUG] PDFViewer loading PDF from:', pdfUrl);
        setIsLoading(true);
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
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

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale, rotation });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (error) {
        console.error('Page render error:', error);
      }
    };

    renderPage();
  }, [pdf, currentPage, scale, rotation]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">PDF読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* コントロールバー */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
        {/* ページコントロール */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &lt;
          </button>
          <span className="text-sm">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &gt;
          </button>
        </div>

        {/* ズームコントロール */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomOut}
            className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
          >
            -
          </button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
          >
            +
          </button>
          <button
            onClick={handleFitToWidth}
            className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm"
          >
            幅に合わせる
          </button>
        </div>

        {/* 回転 */}
        <div>
          <button
            onClick={handleRotate}
            className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
          >
            回転
          </button>
        </div>
      </div>

      {/* PDFキャンバス */}
      <div className="bg-gray-100 rounded-lg overflow-auto" style={{ maxHeight: '800px' }}>
        <canvas ref={canvasRef} className="mx-auto" />
      </div>
    </div>
  );
}
