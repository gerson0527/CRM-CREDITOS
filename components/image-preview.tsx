'use client';

import { useState, useEffect } from 'react';
import { Download, Eye, ZoomIn, X, FileText, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImagePreviewProps {
  mainKey?: string;
  thumbKey?: string;
  filename: string;
  contentType: string;
  size?: number;
  className?: string;
  variant?: 'card' | 'inline';
  canDownload?: boolean;
}

export function ImagePreview({
  mainKey,
  thumbKey,
  filename,
  contentType,
  size,
  className,
  variant = 'card',
  canDownload = true,
}: ImagePreviewProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  const isImage = contentType?.startsWith('image/');
  const isPdf = contentType === 'application/pdf';
  const sizeStr = size ? `${(size / 1024).toFixed(0)}KB` : '';

  useEffect(() => {
    if (!thumbKey || !isImage) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/uploads/preview?key=${encodeURIComponent(thumbKey)}`);
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          if (data.url) setThumbUrl(data.url);
        }
      } catch { /* ignore */ }
    })();
    return () => { mounted = false; };
  }, [thumbKey, isImage]);

  async function loadFullUrl() {
    if (fullUrl || loading) return;
    if (!mainKey) return;
    setLoading(true);
    setErrored(false);
    try {
      const res = await fetch(`/api/uploads/preview?key=${encodeURIComponent(mainKey)}&expires=3600`);
      if (!res.ok) {
        setErrored(true);
        return;
      }
      const data = await res.json();
      if (!data.url) {
        setErrored(true);
        return;
      }
      // Pre-validar que la URL firmada realmente devuelve el archivo
      // (no un XML de error tipo NoSuchKey). Si falla, marcamos error.
      try {
        const probe = await fetch(data.url, { method: 'HEAD' });
        if (!probe.ok) {
          setErrored(true);
          return;
        }
      } catch {
        // Si el navegador bloquea HEAD (CORS), continuamos al iframe.
      }
      setFullUrl(data.url);
      setZoomed(true);
    } catch {
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    if (!mainKey) return;
    try {
      const res = await fetch(`/api/uploads/by-key/download?key=${encodeURIComponent(mainKey)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.downloadUrl) {
        const fileRes = await fetch(data.downloadUrl);
        if (!fileRes.ok) return;
        const blobUrl = URL.createObjectURL(await fileRes.blob());
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
      }
    } catch { /* ignore */ }
  }

  if (!isImage && !isPdf) {
    return (
      <div className={cn(
        'flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3',
        className
      )}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
          <FileText className="h-5 w-5 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{filename}</p>
          {sizeStr && <p className="text-xs text-slate-500">{sizeStr}</p>}
        </div>
        {mainKey && canDownload && (
          <Button size="sm" variant="outline" onClick={download}>
            <Download className="h-3.5 w-3.5" />
            Descargar
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          {errored ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" />
              Archivo no disponible en el storage
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={loadFullUrl}
              disabled={!mainKey || loading}
              className="h-8 rounded-lg text-xs"
              title="Ver documento"
            >
              {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
              Ver documento
            </Button>
          )}
          {canDownload && mainKey && (
            <Button type="button" size="sm" variant="outline" onClick={download} className="h-8 rounded-lg text-xs">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Descargar
            </Button>
          )}
        </div>
        <AnimatePresence>
          {zoomed && fullUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm"
              onClick={() => setZoomed(false)}
            >
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-4 top-4 h-10 w-10 rounded-full"
                onClick={() => setZoomed(false)}
              >
                <X className="h-5 w-5" />
              </Button>
              {isPdf ? (
                <iframe
                  src={fullUrl}
                  title={filename}
                  className="h-[90vh] w-[min(90vw,900px)] rounded-lg bg-white shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <motion.img
                  src={fullUrl}
                  alt={filename}
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              {canDownload && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-4 right-4"
                  onClick={(e) => { e.stopPropagation(); download(); }}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Descargar original
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <>
      <div className={cn(
        'group relative overflow-hidden rounded-xl border border-slate-200 bg-white',
        variant === 'card' ? 'p-2' : 'p-1',
        className
      )}>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-100">
          {errored ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-8 w-8" />
              <span className="px-2 text-center text-[11px] font-medium">Archivo no disponible</span>
            </div>
          ) : thumbUrl ? (
            <img
              src={thumbUrl}
              alt={filename}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
              onError={() => setErrored(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileText className="h-12 w-12" />}
            </div>
          )}
          {!errored && (
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-slate-900/0 opacity-0 transition-all group-hover:bg-slate-900/40 group-hover:opacity-100">
              {mainKey && (
                <Button size="icon" variant="secondary" onClick={loadFullUrl} className="h-8 w-8 rounded-full">
                  <ZoomIn className="h-4 w-4" />
                </Button>
              )}
              {mainKey && canDownload && (
                <Button size="icon" variant="secondary" onClick={download} className="h-8 w-8 rounded-full">
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="px-1 pt-2 pb-1">
          <p className="truncate text-xs font-medium text-slate-900" title={filename}>
            {filename}
          </p>
          {sizeStr && <p className="text-[10px] text-slate-500">{sizeStr}</p>}
        </div>
      </div>

      <AnimatePresence>
        {zoomed && fullUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm"
            onClick={() => setZoomed(false)}
          >
            <Button
              size="icon"
              variant="secondary"
              className="absolute right-4 top-4 h-10 w-10 rounded-full"
              onClick={() => setZoomed(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            {isPdf ? (
              <iframe
                src={fullUrl}
                title={filename}
                className="h-[90vh] w-[min(90vw,900px)] rounded-lg bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <motion.img
                src={fullUrl}
                alt={filename}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {canDownload && (
              <Button
                size="sm"
                variant="secondary"
                className="absolute bottom-4 right-4"
                onClick={(e) => { e.stopPropagation(); download(); }}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Descargar original
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}