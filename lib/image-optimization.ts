import imageCompression from 'browser-image-compression';

/**
 * Compresión y generación de thumbnail en el cliente.
 */

export interface CompressionOptions {
  maxSize?: number;
  quality?: number;
  thumbSize?: number;
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
}

export interface ThumbnailResult {
  file: File;
  size: number;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxSize: 1920,
  quality: 80,
  thumbSize: 320,
};

export async function compressImage(
  file: File,
  opts: CompressionOptions = {}
): Promise<CompressionResult> {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const originalSize = file.size;
  const compressedFile = await imageCompression(file, {
    maxSizeMB: 10,
    maxWidthOrHeight: o.maxSize,
    useWebWorker: true,
    initialQuality: o.quality / 100,
    fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
  });
  const newName = file.name.replace(/\.(png|jpg|jpeg|webp)$/i, '') + '.jpg';
  const finalFile = new File([compressedFile], newName, {
    type: compressedFile.type || 'image/jpeg',
  });
  return {
    file: finalFile,
    originalSize,
    compressedSize: finalFile.size,
    reductionPercent: Math.round((1 - finalFile.size / originalSize) * 100),
  };
}

export async function generateThumbnail(
  file: File,
  opts: CompressionOptions = {}
): Promise<ThumbnailResult> {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const thumb = await imageCompression(file, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: o.thumbSize,
    useWebWorker: true,
    initialQuality: 0.7,
    fileType: 'image/jpeg',
  });
  const thumbName = file.name.replace(/\.(png|jpg|jpeg|webp)$/i, '') + '-thumb.jpg';
  const thumbFile = new File([thumb], thumbName, { type: 'image/jpeg' });
  return { file: thumbFile, size: thumbFile.size };
}

export interface ProcessedFile {
  main: File;
  thumb?: File;
  originalSize: number;
  finalSize: number;
  isImage: boolean;
  reductionPercent?: number;
}

export async function processFileForUpload(
  file: File,
  opts: CompressionOptions = {}
): Promise<ProcessedFile> {
  const originalSize = file.size;
  const isImg = file.type.startsWith('image/');
  if (!isImg) {
    return { main: file, originalSize, finalSize: file.size, isImage: false };
  }
  const [compressed, thumb] = await Promise.all([
    compressImage(file, opts),
    generateThumbnail(file, opts),
  ]);
  return {
    main: compressed.file,
    thumb: thumb.file,
    originalSize,
    finalSize: compressed.compressedSize,
    isImage: true,
    reductionPercent: compressed.reductionPercent,
  };
}

export function uploadToPresignedUrl(
  url: string,
  file: File,
  requiredHeaders: Record<string, string> = {},
  onProgress?: (percent: number) => void
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    Object.entries(requiredHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => reject(new Error('Error de red al subir el archivo'));
    xhr.send(file);
  });
}