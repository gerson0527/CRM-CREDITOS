import crypto from 'crypto';
import { cookies } from 'next/headers';
import { queryOne } from '@/lib/db/pg';

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET no está configurado. La app no arranca en producción sin secreto de sesión.');
  }
  console.warn('[auth] SESSION_SECRET ausente: usando secreto solo para desarrollo local. No usar en producción.');
}
const SECRET = SESSION_SECRET || 'dev-only-insecure-fallback-never-use-in-production';
const COOKIE_NAME = 'crm_session';
// Ventana de inactividad: 12h. Con refresh deslizante, cada request autenticado
// renueva la expiración mientras quede menos de la mitad (6h).
const MAX_AGE_SECONDS = 12 * 60 * 60;
const SLIDING_REFRESH_THRESHOLD_SECONDS = 6 * 60 * 60;

export interface SessionUser {
  id: string;
  email: string;
  status: string;
  role: 'admin' | 'supervisor' | 'asesor';
  full_name: string;
  must_change_password: boolean;
}

// Límite absoluto de sesión aunque haya actividad (anti robo de cookie persistente).
const ABSOLUTE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function sign(payload: string): string {
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function parseSessionToken(token: string): { userId: string; exp: number; iat: number } | null {
  try {
    const idx = token.lastIndexOf('.');
    if (idx === -1) return null;
    const payload = token.slice(0, idx);
    const sig = token.slice(idx + 1);
    const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');

    const sigBuf = Buffer.from(sig, 'hex');
    const expBuf = Buffer.from(expected, 'hex');

    if (sigBuf.length === 0 || expBuf.length === 0 || sigBuf.length !== expBuf.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    const data = JSON.parse(decoded);
    const now = Date.now() / 1000;
    if (typeof data.userId !== 'string' || typeof data.exp !== 'number') return null;
    if (data.exp < now) return null;
    // Tokens viejos (sin iat, previos al deploy) se aceptan por su exp.
    const iat = typeof data.iat === 'number' ? data.iat : data.exp - MAX_AGE_SECONDS;
    if (now - iat > ABSOLUTE_MAX_AGE_SECONDS) return null;
    return { userId: data.userId, exp: data.exp, iat };
  } catch {
    return null;
  }
}

function verify(token: string): string | null {
  return parseSessionToken(token)?.userId ?? null;
}

export function createSessionToken(userId: string, issuedAt?: number): string {
  const iat = issuedAt ?? Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    userId,
    iat,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  });
  return sign(Buffer.from(payload, 'utf-8').toString('base64url'));
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    // Verificado: HttpOnly (JS no puede leerla: mitiga robo vía XSS),
    // SameSite=Lax (mitiga CSRF en navegaciones cross-site),
    // Secure solo en producción (localhost es HTTP).
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export function getSessionUserId(): string | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verify(token);
}

export async function getSessionUser(
  opts: { allowStalePassword?: boolean } = {}
): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const parsed = parseSessionToken(token);
  if (!parsed) return null;
  const user = await queryOne<SessionUser>(
    `SELECT u.id, u.email, u.status, p.role, p.full_name, p.must_change_password
     FROM public.users u
     LEFT JOIN public.profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [parsed.userId]
  );
  if (!user || user.status !== 'activo') return null;
  // La contraseña pendiente de cambio bloquea todo excepto /me, cambio y logout.
  if (user.must_change_password && !opts.allowStalePassword) return null;

  // Refresh deslizante: si queda menos de la mitad de la ventana, renovar
  // conservando el iat original (el cap absoluto sigue corriendo).
  const remaining = parsed.exp - Date.now() / 1000;
  if (remaining < SLIDING_REFRESH_THRESHOLD_SECONDS) {
    try {
      setSessionCookie(createSessionToken(parsed.userId, parsed.iat));
    } catch {
      // Si el contexto no permite escribir cookies, la sesión sigue válida
      // hasta su expiración original.
    }
  }
  return user;
}

/** Respuesta estándar cuando el usuario debe cambiar su contraseña primero. */
export function passwordChangeRequiredResponse() {
  return Response.json(
    { error: 'Debes cambiar tu contraseña antes de continuar.', mustChangePassword: true },
    { status: 403 }
  );
}

// Solo lectura (no renueva la ventana deslizante: es síncrono y no escribe cookies).
// El sliding ocurre en las rutas que usan getSessionUser().
export function getSessionUserFromRequest(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verify(match[1]);
}