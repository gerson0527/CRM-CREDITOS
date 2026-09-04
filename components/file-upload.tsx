'use client';

import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { hasAllowedMagicBytes, processFileForUpload, uploadToPresignedUrl, type ProcessedFile } from '@/lib/image-optimization';
import { isAllowedMimeType } from '@/lib/storage';

export interface UploadedFile {
  key: string;
  thumbKey?: string;
  filename: string;
  size: number;
  contentType: string;
  documentType: string;
}

interface FileUploadProps {
  documentType: string;
  documentLabel: string;
  required?: boolean;
  rootFolder?: string;
  entityId?: string;
  value?: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  className?: string;
  disabled?: boolean;
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,application/pdf';
const MAX_SIZE = parseInt(process.env.NEXT_PUBLIC_STORAGE_MAX_FILE_SIZE_MB || '10', 10) * 1024 * 1024;

export function FileUpload({
  documentType,
  documentLabel,
  required = false,
  rootFolder = 'creditos',
  entityId,
  value,
  onChange,
  className,
  disabled = false,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value?.thumbKey) {
      setThumbUrl(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/uploads/preview?key=${encodeURIComponent(value.thumbKey!)}`);
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          if (data.url) setThumbUrl(data.url);
        }
      } catch { /* ignore */ }
    })();
    return () => { mounted = false; };
  }, [value?.thumbKey]);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await uploadFile(file);
  }

  async function uploadFile(file: File) {
    setError(null);
    setCompressionInfo(null);
    if (!isAllowedMimeType(file.type)) {
      setError(`Tipo no permitido: ${file.type || 'desconocido'}. Solo PDF, JPG, PNG, WebP.`);
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(`Archivo muy grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: ${MAX_SIZE / 1024 / 1024}MB`);
      return;
    }
    // El MIME lo declara el navegador según la extensión: verificar contenido real.
    if (!(await hasAllowedMagicBytes(file))) {
      setError('El contenido del archivo no coincide con un PDF o imagen válida.');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      let processed: ProcessedFile;
      try {
        processed = await processFileForUpload(file);
      } catch (err: any) {
        setError(`Error al procesar: ${err.message}`);
        setUploading(false);
        return;
      }
      if (processed.isImage && processed.reductionPercent !== undefined) {
        setCompressionInfo(
          `${(processed.originalSize / 1024).toFixed(0)}KB → ${(processed.finalSize / 1024).toFixed(0)}KB (-${processed.reductionPercent}%)`
        );
      }
      const presignedRes = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: processed.main.name,
          contentType: processed.main.type,
          documentType,
          entityId,
          rootFolder,
          variant: 'main',
        }),
      });
      const presigned = await presignedRes.json();
      if (!presignedRes.ok) throw new Error(presigned.error || 'Error al obtener URL de subida');
      const ok = await uploadToPresignedUrl(
        presigned.uploadUrl,
        processed.main,
        presigned.requiredHeaders,
        (p) => setProgress(p)
      );
      if (!ok) throw new Error('Falló la subida del archivo principal');
      let thumbKey: string | undefined;
      if (processed.thumb) {
        try {
          const thumbRes = await fetch('/api/uploads/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: processed.thumb.name,
              contentType: processed.thumb.type,
              documentType,
              entityId,
              rootFolder,
              variant: 'thumb',
            }),
          });
          const thumbPresigned = await thumbRes.json();
          if (thumbRes.ok) {
            await uploadToPresignedUrl(thumbPresigned.uploadUrl, processed.thumb, thumbPresigned.requiredHeaders);
            thumbKey = thumbPresigned.key;
            if (thumbKey) {
              const tRes = await fetch(`/api/uploads/preview?key=${encodeURIComponent(thumbKey)}`);
              if (tRes.ok) {
                const tData = await tRes.json();
                if (tData.url) setThumbUrl(tData.url);
              }
            }
          }
        } catch { /* ignore thumb errors */ }
      }
      onChange({
        key: presigned.key,
        thumbKey,
        filename: processed.main.name,
        size: processed.main.size,
        contentType: processed.main.type,
        documentType,
      });
    } catch (err: any) {
      setError(err.message || 'Error al subir');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  function remove() {
    onChange(null);
    setError(null);
    setCompressionInfo(null);
    setThumbUrl(null);
  }

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-3', className)}>
      <div className="flex items-start gap-3">
        {thumbUrl && (
          <img
            src={thumbUrl}
            alt=""
            className="h-12 w-12 rounded-lg object-cover border border-slate-200 shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 truncate">{documentLabel}</span>
            {required && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2">
                Requerido
              </span>
            )}
          </div>
          {value ? (
            <div className="mt-1.5 flex items-center gap-2 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1">{value.filename}</span>
              <span className="text-slate-400">({(value.size / 1024).toFixed(0)}KB)</span>
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-slate-400">
              PDF, JPG, PNG o WebP. Máx {MAX_SIZE / 1024 / 1024}MB.
            </p>
          )}
          {compressionInfo && (
            <p className="mt-0.5 text-[10px] text-emerald-600">📦 {compressionInfo}</p>
          )}
          {uploading && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          )}
          {error && (
            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {value ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={remove}
              className="h-7 w-7 text-slate-400 hover:text-red-600"
              type="button"
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <label>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                onChange={handleFile}
                className="hidden"
                disabled={disabled || uploading}
              />
              <span
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'inline-flex h-7 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50',
                  (disabled || uploading) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {uploading ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="mr-1 h-3 w-3" />
                )}
                {uploading ? `${progress}%` : 'Subir'}
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}