import { NextResponse } from 'next/server';
import { query } from '@/lib/db/pg';
import { deleteObjects, listStaleTempObjects } from '@/lib/storage';

/**
 * Limpieza de archivos temporales huérfanos (subidas abandonadas).
 * Se ejecuta mediante Vercel Cron diariamente. Vercel envía
 * Authorization: Bearer $CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const olderThan = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const candidates = await listStaleTempObjects(olderThan);

    // Los créditos creados antes guardan keys "temp" en documents.file_url:
    // no se pueden borrar aunque sean antiguos.
    const docs = await query<{ file_url: string }>(
      `SELECT file_url FROM public.documents WHERE file_url IS NOT NULL`
    );
    const referenced = new Set<string>();
    for (const doc of docs) {
      try {
        const parsed = JSON.parse(doc.file_url);
        if (typeof parsed?.original === 'string') referenced.add(parsed.original);
        if (typeof parsed?.thumb === 'string') referenced.add(parsed.thumb);
      } catch {
        // file_url puede ser un string plano en datos antiguos.
        if (typeof doc.file_url === 'string' && doc.file_url.startsWith('creditos/')) {
          referenced.add(doc.file_url);
        }
      }
    }

    const toDelete = candidates.filter((key) => !referenced.has(key));
    if (toDelete.length > 0) {
      await deleteObjects(toDelete);
    }
    return NextResponse.json({ ok: true, scanned: candidates.length, deleted: toDelete.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error en limpieza' }, { status: 500 });
  }
}
