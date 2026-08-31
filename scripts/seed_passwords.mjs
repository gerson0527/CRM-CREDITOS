// Genera password_hash bcrypt para los usuarios demo y los actualiza en la DB.
// Uso: node scripts/seed_passwords.mjs

import bcrypt from 'bcryptjs';
import { Client } from 'pg';

const DEMO_PASSWORD = 'Credi123456!';
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
  console.log(`Hash generado: ${hash.slice(0, 20)}...`);

  for (const u of USERS) {
    const res = await client.query(
      `UPDATE public.profiles
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
  console.log('\n✓ Listo. Ahora puedes login con:');
  console.log('  admin@credilibranzas.com / Credi123456!');
  console.log('  supervisor@credilibranzas.com / Credi123456!');
  console.log('  asesor1@credilibranzas.com / Credi123456!');
  console.log('  etc.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});