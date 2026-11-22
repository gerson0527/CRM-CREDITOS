import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL || process.argv[2];

if (!connectionString) {
  console.error('\n❌ ERROR: Falta la cadena de conexión (DATABASE_URL).\n');
  console.error('Uso:');
  console.error('  DATABASE_URL="postgresql://user:pass@ep-xyz-pooler.neon.tech/neondb?sslmode=require" node scripts/setup_neon.mjs');
  console.error('  o');
  console.error('  node scripts/setup_neon.mjs "postgresql://user:pass@ep-xyz-pooler.neon.tech/neondb?sslmode=require"\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('🚀 Conectando a la base de datos Neon...');
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, '..', 'supabase', 'neon_complete_setup.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📦 Ejecutando migración completa en Neon (supabase/neon_complete_setup.sql)...');
    await client.query(sql);

    console.log('✅ Migración ejecutada con éxito!\n');

    // Verificar tablas creadas
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('📊 Tablas verificadas en Neon:');
    tablesRes.rows.forEach(r => console.log(`  - ${r.table_name}`));

    // Verificar admin
    const adminRes = await client.query(`
      SELECT u.id, u.email, u.status, p.full_name, p.role, p.must_change_password
      FROM public.users u
      JOIN public.profiles p ON p.user_id = u.id
      WHERE u.email = 'admin@credilibranzas.com';
    `);

    if (adminRes.rows.length > 0) {
      console.log('\n👤 Usuario Administrador configurado:');
      console.log('  Email:   admin@credilibranzas.com');
      console.log('  Clave:   Admin2026* (solicitará cambio en el primer login)');
      console.log('  Rol:    ', adminRes.rows[0].role);
    }

    console.log('\n🎉 ¡Base de datos Neon lista para conectar con Vercel!\n');
  } catch (err) {
    console.error('\n❌ Error al ejecutar la migración:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
