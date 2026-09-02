import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cliente S3 agnóstico al proveedor.
 *
 * Configurar mediante variables de entorno (ver .env.example):
 *   STORAGE_ENDPOINT, STORAGE_REGION, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY, STORAGE_BUCKET
 */

const config = {
  endpoint: process.env.STORAGE_ENDPOINT || '',
  region: process.env.STORAGE_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY || '',
    secretAccessKey: process.env.STORAGE_SECRET_KEY || '',
  },
  forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
};

let _client: S3Client | null = null;

function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      endpoint: config.endpoint || undefined,
      region: config.region,
      credentials: config.credentials,
      forcePathStyle: config.forcePathStyle,
    });
  }
  return _client;
}

function bucket(): string {
  const b = process.env.STORAGE_BUCKET;
  if (!b) throw new Error('STORAGE_BUCKET no está configurado');
  return b;
}

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
}

export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300
): Promise<PresignedUpload> {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client(), command, { expiresIn: expiresInSeconds });
  return {
    uploadUrl,
    key,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    requiredHeaders: { 'Content-Type': contentType },
  };
}

export async function getDownloadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(client(), command, { expiresIn: expiresInSeconds });
}

export async function deleteFile(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export function generateKey(opts: {
  rootFolder: string;
  documentType: string;
  filename: string;
  entityId?: string;
  variant?: 'thumb' | 'main';
}): string {
  const ext = opts.filename.includes('.') ? opts.filename.split('.').pop()!.toLowerCase() : 'bin';
  const uuid = crypto.randomUUID();
  const id = opts.entityId || 'temp';
  const base = `${opts.rootFolder}/${id}/${opts.documentType}/${uuid}`;
  return opts.variant === 'thumb' ? `${base}-thumb.${ext}` : `${base}.${ext}`;
}

export const ALLOWED_MIME_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
  documents: ['application/pdf'],
  all: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'],
} as const;

export function isAllowedMimeType(mime: string): boolean {
  return (ALLOWED_MIME_TYPES.all as readonly string[]).includes(mime);
}

export function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}