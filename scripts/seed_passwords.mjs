// Asigna un password_hash bcrypt a los usuarios demo YA EXISTENTES en la DB local.
// La contraseña NUNCA se hardcodea: se lee de SEED_DEMO_PASSWORD y jamás se imprime.
//
// Uso (PowerShell):
//   $env:SEED_DEMO_PASSWORD="una-contraseña-local-fuerte"
//   $env:DATABASE_URL="postgresql://postgres@localhost:5432/credilibranzasjg"
//   node scripts/seed_passwords.mjs
//
// Solo para desarrollo local. Nunca ejecutes esto contra producción
// con una contraseña compartida o publicada.

import bcrypt from 'bcryptjs';
import { Client } from 'pg';

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD;
if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 12) {
  console.error(
    'Falta SEED_DEMO_PASSWORD (mínimo 12 caracteres). ' +
    'Defínela solo en tu entorno local, sin commitearla.'
  );
  process.exit(1);
}

const USERS = [
  { email: 'admin@credilibranzas.com',     role: 'admin' },
  { email: 'supervisor@credilibranzas.com', role: 'supervisor' },
  { email: 'asesor1@credilibranzas.com',    role: 'asesor' },
  { email: 'asesor2@credilibranzas.com',    role: 'asesor' },
  { email: 'asesor3@credilibranzas.com',    role: 'asesor' },
];

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/credilibranzasjg';
const client = new Client({ connectionString, ssl: false });

async function main() {
  await client.connect();
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const u of USERS) {
    const res = await client.query(
      `UPDATE public.users
       SET password_hash = $1
       WHERE email = $2
       RETURNING email`,
      [hash, u.email]
    );
    if (res.rowCount === 0) {
      console.log(`  ✕ ${u.email}: no existe`);
    } else {
      console.log(`  ✓ ${u.email}: password_hash actualizado`);
    }
  }

  await client.end();
  console.log('\n✓ Listo. Usa la contraseña que definiste en SEED_DEMO_PASSWORD (no se muestra aquí por seguridad).');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});