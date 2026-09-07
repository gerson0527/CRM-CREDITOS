import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { getSessionUser } from '@/lib/auth/session';
import { getVisibleAsesorIds } from '@/lib/auth/visibility';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const asesorIds = await getVisibleAsesorIds(user);
    return NextResponse.json({ asesorIds });
  } catch (err) {
    return apiError(err, 'No se pudo obtener el equipo visible.');
  }
}
