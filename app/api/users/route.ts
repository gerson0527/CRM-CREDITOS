import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '@/lib/db/pg';
import { getSessionUser } from '@/lib/auth/session';

interface CreateUserBody {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'supervisor' | 'asesor' | string;
  role_id?: string | null;
  supervisor_id?: string | null;
  sede_id?: string | null;
  monthly_goal?: number;
  commission_rate?: number;
  phone?: string | null;
}

export async function POST(request: Request) {
  // 1. Validar permisos de administrador
  const caller = await getSessionUser();
  if (!caller) {
    return NextResponse.json({ error: 'No autorizado: Sesión no válida' }, { status: 401 });
  }

  if (caller.role !== 'admin') {
    return NextResponse.json(
      { error: 'Solo administradores pueden crear usuarios' },
      { status: 403 }
    );
  }

  // 2. Parsear el cuerpo de la petición
  let body: CreateUserBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
  }

  const { email, password, full_name, role, role_id, supervisor_id, sede_id, monthly_goal, commission_rate, phone } = body;

  if (!email || !password || !full_name || !role) {
    return NextResponse.json(
      { error: 'Faltan campos requeridos: email, password, full_name, role' },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  // 3. Verificar si el correo ya existe
  const existingUser = await queryOne<{ id: string }>(
    `SELECT id FROM public.users WHERE email = $1`,
    [normalizedEmail]
  );
  if (existingUser) {
    return NextResponse.json(
      { error: 'El correo electrónico ya se encuentra registrado' },
      { status: 400 }
    );
  }

  // 4. Resolver role_id si no se provee
  let resolvedRoleId = role_id;
  if (!resolvedRoleId) {
    const roleData = await queryOne<{ id: string }>(
      `SELECT id FROM public.roles WHERE slug = $1 LIMIT 1`,
      [role]
    );
    resolvedRoleId = roleData?.id || null;
  }

  if (role === 'asesor' && !supervisor_id) {
    return NextResponse.json(
      { error: 'Los asesores deben tener un supervisor asignado' },
      { status: 400 }
    );
  }

  try {
    // 5. Generar Hash de la contraseña con bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // 6. Crear usuario en public.users
    const createdUser = await queryOne<{ id: string }>(
      `INSERT INTO public.users (email, password_hash, status)
       VALUES ($1, $2, 'activo')
       RETURNING id`,
      [normalizedEmail, passwordHash]
    );

    if (!createdUser?.id) {
      return NextResponse.json({ error: 'Error al crear el usuario en la base de datos' }, { status: 500 });
    }

    // 7. Crear perfil en public.profiles
    const createdProfile = await queryOne<{ id: string }>(
      `INSERT INTO public.profiles (
        id, user_id, email, full_name, role, role_id, supervisor_id, sede_id, monthly_goal, commission_rate, phone, status, must_change_password
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'activo', true)
      RETURNING id`,
      [
        createdUser.id,
        createdUser.id,
        normalizedEmail,
        full_name.trim(),
        role,
        resolvedRoleId,
        role === 'asesor' ? supervisor_id : null,
        sede_id || null,
        monthly_goal ? Number(monthly_goal) : 0,
        commission_rate ? Number(commission_rate) : 0,
        phone ? phone.trim() : null,
      ]
    );

    return NextResponse.json({
      success: true,
      user: {
        id: createdUser.id,
        email: normalizedEmail,
        full_name,
        role,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Error al registrar el usuario: ${err.message}` }, { status: 500 });
  }
}