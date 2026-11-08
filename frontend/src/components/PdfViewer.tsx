"use client";

import React, { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, FileText, Image as ImageIcon } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';

interface PdfViewerProps {
  url?: string;
  file?: File | null;
}

export default function PdfViewer({ url, file }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1.0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [isImage, setIsImage] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdBlobUrl: string | null = null;

    const loadDocument = async () => {
      setLoading(true);
      setError(null);
      setIsImage(false);
      setImageSrc(null);
      setPdfDoc(null);

      try {
        // --- 1. HANDLE LOCAL FILE OBJECT ---
        if (file) {
          const isImgName = /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
          const isImgType = file.type.startsWith('image/');

          if (isImgName || isImgType) {
            const blobUrl = URL.createObjectURL(file);
            createdBlobUrl = blobUrl;
            if (active) {
              setIsImage(true);
              setImageSrc(blobUrl);
              setLoading(false);
            }
            return;
          }

          const arrayBuffer = await file.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer.slice(0, 10));
          const header = String.fromCharCode(...bytes);

          // Check if file is secretly an image (misnamed or uploaded as generic file)
          const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8;
          const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
          if (isJpeg || isPng || header.startsWith('GIF') || header.includes('WEBP')) {
            const blob = new Blob([arrayBuffer]);
            const blobUrl = URL.createObjectURL(blob);
            createdBlobUrl = blobUrl;
            if (active) {
              setIsImage(true);
              setImageSrc(blobUrl);
              setLoading(false);
            }
            return;
          }

          // Check for valid PDF header
          if (!header.startsWith('%PDF-')) {
            if (active) {
              setError("The selected file is not a valid PDF or image document.");
              setLoading(false);
            }
            return;
          }

          // Parse with PDF.js
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
          const doc = await loadingTask.promise;
          if (active) {
            setPdfDoc(doc);
          }
          return;
        }

        // --- 2. HANDLE REMOTE OR RELATIVE URL ---
        if (url) {
          const resolved = resolveMediaUrl(url);

          // Quick extension or data URI check for images
          if (/\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(resolved) || resolved.startsWith('data:image/')) {
            if (active) {
              setIsImage(true);
              setImageSrc(resolved);
              setLoading(false);
            }
            return;
          }

          const res = await fetch(resolved);
          if (!res.ok) {
            throw new Error(`Failed to fetch document: HTTP ${res.status} (${res.statusText || 'Not Found'})`);
          }

          const arrayBuffer = await res.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer.slice(0, 10));
          const header = String.fromCharCode(...bytes);

          // If the server returned an HTML error page (e.g. 404 or 500 HTML)
          if (header.startsWith('<!DOC') || header.startsWith('<html') || header.startsWith('<?xml')) {
            if (active) {
              setError("Document file was not found on the server or is not accessible.");
              setLoading(false);
            }
            return;
          }

          // Check if bytes are actually an image
          const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8;
          const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
          if (isJpeg || isPng || header.startsWith('GIF') || header.includes('WEBP')) {
            if (active) {
              setIsImage(true);
              setImageSrc(resolved);
              setLoading(false);
            }
            return;
          }

          // Check for valid PDF magic header (%PDF-)
          if (!header.startsWith('%PDF-')) {
            if (active) {
              setError("The document format is not recognized as a valid PDF.");
              setLoading(false);
            }
            return;
          }

          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
          const doc = await loadingTask.promise;
          if (active) {
            setPdfDoc(doc);
          }
          return;
        }

        throw new Error("No document source provided.");
      } catch (err: any) {
        if (active) {
          console.warn("Document preview notice:", err?.message || err);
          setError(err?.message || "Failed to load document preview.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      active = false;
      if (createdBlobUrl) {
        try {
          URL.revokeObjectURL(createdBlobUrl);
        } catch {
          // ignore
        }
      }
    };
  }, [url, file]);

  // PDF Page rendering effect
  useEffect(() => {
    if (!pdfDoc || isImage) return;

    let renderTask: any = null;

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
          viewport: viewport,
        };
        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn("Page render notice:", err);
        }
      }
    };

    renderPage();

    return () => {
      if (renderTask && typeof renderTask.cancel === 'function') {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, scale, isImage]);

  return (
    <div className="flex flex-col items-center w-full h-full min-h-[300px]">
      {/* Zoom controls */}
      <div className="flex gap-2 p-2 bg-slate-100/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 mb-3 shrink-0 z-10 shadow-sm">
        <button
          type="button"
          onClick={() => setScale((prev) => Math.max(0.5, prev - 0.25))}
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
          onClick={() => setScale((prev) => Math.min(3.0, prev + 0.25))}
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

      {/* Document container */}
      <div className="flex-grow w-full overflow-auto bg-slate-50/70 p-6 flex items-start justify-center border border-slate-200/80 rounded-3xl custom-scrollbar relative">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
            <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <span className="text-xs font-bold uppercase tracking-wider">Loading Document Preview...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-2 py-16 text-center max-w-md">
            <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl border border-rose-100">
              <FileText size={28} />
            </div>
            <p className="text-xs font-bold text-rose-600 mt-2">{error}</p>
            <p className="text-[10px] text-slate-400">Please verify the file exists on the server or try re-uploading.</p>
          </div>
        )}

        {/* IMAGE PREVIEW */}
        {isImage && imageSrc && !loading && !error && (
          <div className="flex items-center justify-center p-2 transition-transform duration-200 origin-top" style={{ transform: `scale(${scale})` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt="Document Preview"
              className="max-w-full max-h-[70vh] rounded-2xl border border-slate-200 shadow-lg object-contain bg-white"
            />
          </div>
        )}

        {/* PDF CANVAS */}
        {!isImage && (
          <canvas
            ref={canvasRef}
            className="border border-slate-200 shadow-lg rounded-2xl max-w-full bg-white transition-transform duration-200"
            style={{ display: loading || error ? 'none' : 'block' }}
          />
        )}
      </div>
    </div>
  );
}
