import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { queryOne } from '@/lib/db/pg';
import { createSessionToken, setSessionCookie } from '@/lib/auth/session';

interface LoginBody {
  email: string;
  password: string;
}

// In-Memory Rate Limiter para mitigar ataques de fuerza bruta
const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

interface RateLimitEntry {
  attempts: number;
  resetTime: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();

function isRateLimited(key: string): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (!entry) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  if (now > entry.resetTime) {
    loginAttempts.delete(key);
    return { limited: false, retryAfterSeconds: 0 };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
    return { limited: true, retryAfterSeconds };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (!entry || now > entry.resetTime) {
    loginAttempts.set(key, { attempts: 1, resetTime: now + LOCKOUT_WINDOW_MS });
  } else {
    entry.attempts += 1;
  }
}

function clearRateLimit(key: string) {
  loginAttempts.delete(key);
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-ip';

  let body: LoginBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const rateLimitKey = `${ip}:${normalizedEmail}`;

  // Verificar Rate Limiting
  const rateLimitStatus = isRateLimited(rateLimitKey);
  if (rateLimitStatus.limited) {
    return NextResponse.json(
      {
        error: `Demasiados intentos fallidos. Por seguridad, intenta nuevamente en ${Math.ceil(
          rateLimitStatus.retryAfterSeconds / 60
        )} minutos.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimitStatus.retryAfterSeconds) },
      }
    );
  }

  const user = await queryOne<{
    id: string;
    email: string;
    status: string;
    password_hash: string | null;
    role: 'admin' | 'supervisor' | 'asesor' | null;
    full_name: string | null;
  }>(
    `SELECT u.id, u.email, u.status, u.password_hash,
            p.role, p.full_name
     FROM public.users u
     LEFT JOIN public.profiles p ON p.user_id = u.id
     WHERE u.email = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  if (!user) {
    recordFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  if (user.status !== 'activo') {
    return NextResponse.json(
      { error: `Tu cuenta está ${user.status.replace('_', ' ')}. Contacta al administrador.` },
      { status: 403 }
    );
  }

  if (!user.password_hash) {
    return NextResponse.json(
      { error: 'Esta cuenta no tiene contraseña configurada. Contacta al administrador.' },
      { status: 403 }
    );
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    recordFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  // Éxito: Limpiar contador de intentos
  clearRateLimit(rateLimitKey);

  const token = createSessionToken(user.id);
  setSessionCookie(token);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role,
      full_name: user.full_name,
    },
  });
}