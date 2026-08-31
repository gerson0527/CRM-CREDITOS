import crypto from 'crypto';
import { cookies } from 'next/headers';
import { queryOne } from '@/lib/db/pg';

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
const COOKIE_NAME = 'crm_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface SessionUser {
  id: string;
  email: string;
  status: string;
  role: 'admin' | 'supervisor' | 'asesor';
  full_name: string;
}

function sign(payload: string): string {
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verify(token: string): string | null {
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
    if (typeof data.userId !== 'string' || typeof data.exp !== 'number') return null;
    if (data.exp < Date.now() / 1000) return null;
    return data.userId;
  } catch {
    return null;
  }
}

export function createSessionToken(userId: string): string {
  const payload = JSON.stringify({
    userId,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  });
  return sign(Buffer.from(payload, 'utf-8').toString('base64url'));
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
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

export async function getSessionUser(): Promise<SessionUser | null> {
  const userId = getSessionUserId();
  if (!userId) return null;
  const user = await queryOne<SessionUser>(
    `SELECT u.id, u.email, u.status, p.role, p.full_name
     FROM public.users u
     LEFT JOIN public.profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return user && user.status === 'activo' ? user : null;
}

export function getSessionUserFromRequest(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verify(match[1]);
}