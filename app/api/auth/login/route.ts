import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '@/lib/db/pg';
import { createSessionToken, setSessionCookie, registerSession } from '@/lib/auth/session';

interface LoginBody {
  email: string;
  password: string;
}

// Rate limit persistido en DB (public.login_attempts).
// Escala correctamente entre replicas del servidor (no es un Map en memoria).
const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SECONDS = 15 * 60; // 15 minutos

interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

async function isRateLimited(key: string): Promise<RateLimitResult> {
  const row = await queryOne<{ attempts: number; reset_at: Date }>(
    `SELECT attempts, reset_at FROM public.login_attempts WHERE rate_key = $1`,
    [key]
  );
  if (!row) return { limited: false, retryAfterSeconds: 0 };
  const now = Date.now();
  const resetMs = new Date(row.reset_at).getTime();
  if (now > resetMs) {
    // Ventana expirada: limpiar y permitir.
    await query(`DELETE FROM public.login_attempts WHERE rate_key = $1`, [key]);
    return { limited: false, retryAfterSeconds: 0 };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { limited: true, retryAfterSeconds: Math.ceil((resetMs - now) / 1000) };
  }
  return { limited: false, retryAfterSeconds: 0 };
}

async function recordFailedAttempt(key: string): Promise<void> {
  const resetAt = new Date(Date.now() + LOCKOUT_WINDOW_SECONDS * 1000);
  await query(
    `INSERT INTO public.login_attempts (rate_key, attempts, reset_at, updated_at)
     VALUES ($1, 1, $2, now())
     ON CONFLICT (rate_key) DO UPDATE SET
       attempts = CASE
         WHEN public.login_attempts.reset_at < now() THEN 1
         ELSE public.login_attempts.attempts + 1
       END,
       reset_at = CASE
         WHEN public.login_attempts.reset_at < now() THEN EXCLUDED.reset_at
         ELSE public.login_attempts.reset_at
       END,
       updated_at = now()`,
    [key, resetAt]
  );
}

async function clearRateLimit(key: string): Promise<void> {
  await query(`DELETE FROM public.login_attempts WHERE rate_key = $1`, [key]);
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
  const rateLimitStatus = await isRateLimited(rateLimitKey);
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

  let user: {
    id: string;
    email: string;
    status: string;
    password_hash: string | null;
    role: 'admin' | 'supervisor' | 'asesor' | null;
    full_name: string | null;
  } | null;
  try {
    user = await queryOne(
      `SELECT u.id, u.email, u.status, u.password_hash,
              p.role, p.full_name
       FROM public.users u
       LEFT JOIN public.profiles p ON p.user_id = u.id
       WHERE u.email = $1
       LIMIT 1`,
      [normalizedEmail]
    );
  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno al consultar la base de datos' }, { status: 500 });
  }

  if (!user) {
    await recordFailedAttempt(rateLimitKey);
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

  let ok = false;
  try {
    ok = await bcrypt.compare(password, user.password_hash);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno al validar las credenciales' }, { status: 500 });
  }
  if (!ok) {
    await recordFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  // Éxito: Limpiar contador de intentos
  await clearRateLimit(rateLimitKey);

  const token = createSessionToken(user.id);
  setSessionCookie(token);
  await registerSession(user.id, token, {
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent'),
  });

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