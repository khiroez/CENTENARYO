"use client";

import React, { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface PdfViewerProps {
  url?: string;
  file?: File | null;
}

export default function PdfViewer({ url, file }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1.0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        
        let loadingTask;
        if (file) {
          const arrayBuffer = await file.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        } else if (url) {
          loadingTask = pdfjsLib.getDocument(url);
        } else {
          throw new Error("No PDF source provided");
        }
        
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
      } catch (err: any) {
        console.error("PDF loading error:", err);
        setError("Failed to load PDF file. It might not be a valid PDF or the path is unreachable.");
      } finally {
        setLoading(false);
      }
    };
    loadPdf();
  }, [url, file]);

  useEffect(() => {
    if (!pdfDoc) return;
    
    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(1);
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;
        
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        await page.render(renderContext).promise;
      } catch (err) {
        console.error("Page render error:", err);
      }
    };
    
    renderPage();
  }, [pdfDoc, scale]);

  return (
    <div className="flex flex-col items-center w-full h-full min-h-[300px]">
      {/* Zoom controls */}
      <div className="flex gap-2 p-2 bg-slate-100/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 mb-3 shrink-0 z-10 shadow-sm">
        <button 
          type="button"
          onClick={() => setScale(prev => Math.max(0.5, prev - 0.25))}
          className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <span className="text-[10px] font-black text-slate-600 flex items-center px-2 min-w-[50px] justify-center select-none uppercase tracking-wider">
          {Math.round(scale * 100)}%
        </span>
        <button 
          type="button"
          onClick={() => setScale(prev => Math.min(3.0, prev + 0.25))}
          className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button 
          type="button"
          onClick={() => setScale(1.0)}
          className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center transition-colors"
          title="Reset Zoom"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Canvas container */}
      <div className="flex-grow w-full overflow-auto bg-slate-50/50 p-4 flex items-start justify-center border border-slate-200/60 rounded-3xl custom-scrollbar">
        {loading && <div className="text-slate-400 font-bold py-12">Loading PDF...</div>}
        {error && <div className="text-rose-500 font-bold py-12">{error}</div>}
        <canvas ref={canvasRef} className="border border-slate-200 shadow-md rounded-xl max-w-full bg-white transition-transform duration-200" style={{ display: loading || error ? 'none' : 'block' }} />
      </div>
    </div>
  );
}
