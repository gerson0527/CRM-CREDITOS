// Seed con muchos créditos para demo/testing
// Uso: node scripts/seed_credits.mjs

import { Client } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/credilibranzasjg';
const client = new Client({ connectionString, ssl: false });

const STATUSES = ['lead', 'documentacion', 'enviado', 'estudio', 'aprobado', 'desembolsado', 'rechazado', 'desistido'];
const STATUS_WEIGHTS = [0.15, 0.10, 0.10, 0.10, 0.15, 0.25, 0.10, 0.05]; // probabilidades

const ENTITY_WEIGHTS = {
  'Banco de Bogotá': 0.20,
  'Bancolombia': 0.25,
  'Banco Popular': 0.10,
  'BBVA Colombia': 0.12,
  'Banco Caja Social': 0.08,
  'Davivienda': 0.12,
  'Banco de Occidente': 0.06,
  'Scotiabank Colpatria': 0.07,
};

const CITIES = ['Bogotá - Centro', 'Bogotá - Norte', 'Bogotá - Sur', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Pereira', 'Cartagena', 'Manizales'];
const FIRST_NAMES = ['Carlos', 'María', 'José', 'Ana', 'Luis', 'Diana', 'Jorge', 'Patricia', 'Roberto', 'Sandra', 'Miguel', 'Laura', 'Andrés', 'Carolina', 'Felipe', 'Camila', 'Diego', 'Valentina', 'Sebastián', 'Camila'];
const LAST_NAMES = ['Ramírez López', 'González Pérez', 'Hernández Castro', 'Martínez Ruiz', 'García Vargas', 'López Mendoza', 'Sánchez Ortiz', 'Ramírez Vega', 'Morales Castro', 'Torres Díaz', 'Romero Silva', 'Castro Mendoza', 'Ortiz Vargas', 'Reyes Castro', 'Jiménez Vega'];

function pickWeighted(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function pickWeightedMap(map) {
  const items = Object.keys(map);
  const weights = items.map((k) => map[k]);
  return pickWeighted(items, weights);
}

function randomDateBetween(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomDocNumber() {
  return String(Math.floor(10000000 + Math.random() * 89999999));
}

function randomPhone() {
  return `+57 3${Math.floor(10 + Math.random() * 90)}${Math.floor(1000000 + Math.random() * 8999999)}`;
}

function randomEmail(name) {
  const clean = name.toLowerCase().replace(/\s+/g, '.').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return `${clean}.${Math.floor(Math.random() * 999)}@example.com`;
}

async function main() {
  await client.connect();
  console.log('Connected to DB');

  // Limpiar créditos existentes (opcional — comentar para no perder data)
  console.log('Clearing existing credits...');
  await client.query('DELETE FROM public.credit_status_history');
  await client.query('DELETE FROM public.documents');
  await client.query('DELETE FROM public.follow_ups');
  await client.query('DELETE FROM public.credits');

  // Cargar datos base
  const { rows: clients } = await client.query('SELECT id, first_name, last_name, created_by FROM public.clients ORDER BY id');
  const { rows: asesores } = await client.query(
    "SELECT id, full_name FROM public.profiles WHERE role = 'asesor' AND status = 'activo' ORDER BY id"
  );
  const { rows: entities } = await client.query('SELECT id, name FROM public.financial_entities WHERE active = true');
  const { rows: creditTypes } = await client.query('SELECT id, name, default_rate FROM public.credit_types WHERE active = true');

  if (asesores.length === 0) {
    console.error('No hay asesores activos. Crea al menos uno primero.');
    process.exit(1);
  }

  console.log(`Found: ${clients.length} clientes, ${asesores.length} asesores, ${entities.length} entidades, ${creditTypes.length} tipos de crédito`);

  // Configuración
  const NUM_CREDITS = 80;
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  let inserted = 0;
  let withStatusHistory = 0;
  let withFollowups = 0;
  let withDocs = 0;

  console.log(`Insertando ${NUM_CREDITS} créditos...`);

  for (let i = 0; i < NUM_CREDITS; i++) {
    const cli = clients[Math.floor(Math.random() * clients.length)];
    const asesor = cli.created_by
      ? asesores.find((a) => a.id === cli.created_by) || asesores[0]
      : asesores[Math.floor(Math.random() * asesores.length)];
    const entity = entities.find((e) => e.name === pickWeightedMap(ENTITY_WEIGHTS)) || entities[0];
    const creditType = creditTypes[Math.floor(Math.random() * creditTypes.length)];
    const status = pickWeighted(STATUSES, STATUS_WEIGHTS);
    const createdAt = randomDateBetween(oneYearAgo, now);
    const updatedAt = new Date(createdAt.getTime() + Math.random() * (now.getTime() - createdAt.getTime()));
    const statusChangedAt = new Date(updatedAt.getTime() - Math.random() * 86400000 * 5);
    const amount = Math.floor((2 + Math.random() * 48) * 1000000);
    const approvedAmount = ['aprobado', 'desembolsado'].includes(status) ? amount : null;
    const termMonths = [12, 24, 36, 48, 60][Math.floor(Math.random() * 5)];
    const rate = Number(creditType.default_rate) + (Math.random() * 4 - 2);
    const rejectionReason = status === 'rechazado' ? 'No cumple con los requisitos de la entidad' : null;

    const result = await client.query(
      `INSERT INTO public.credits (
        client_id, asesor_id, entity_id, credit_type_id, status,
        requested_amount, approved_amount, term_months, rate, rejection_reason,
        created_at, updated_at, status_changed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        cli.id, asesor.id, entity.id, creditType.id, status,
        amount, approvedAmount, termMonths, rate.toFixed(2), rejectionReason,
        createdAt, updatedAt, statusChangedAt,
      ]
    );
    const creditId = result.rows[0].id;
    inserted++;

    // Status history (trayectoria desde 'lead' hasta status actual)
    const statusOrder = ['lead', 'documentacion', 'enviado', 'estudio', 'aprobado', 'desembolsado'];
    const currentIdx = statusOrder.indexOf(status);
    if (currentIdx >= 0) {
      const traj = statusOrder.slice(0, currentIdx + 1);
      if (status === 'rechazado' || status === 'desistido') {
        traj.push(status);
      }
      for (let j = 0; j < traj.length; j++) {
        const transitionDate = new Date(createdAt.getTime() + j * 86400000 * 5 * Math.random() + j * 3600000);
        const prev = j === 0 ? null : traj[j - 1];
        await client.query(
          `INSERT INTO public.credit_status_history (credit_id, previous_status, new_status, changed_by, changed_at, comment)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [creditId, prev, traj[j], asesor.id, transitionDate, `Transición a ${traj[j]}`]
        );
        withStatusHistory++;
      }
    }

    // Follow-ups (50% de probabilidad)
    if (Math.random() < 0.5) {
      const fuDate = randomDateBetween(createdAt, now);
      const completed = fuDate < new Date(now.getTime() - 86400000 * 3);
      await client.query(
        `INSERT INTO public.follow_ups (credit_id, asesor_id, channel, comment, contact_date, next_action_date, completed)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          creditId, asesor.id,
          ['llamada', 'whatsapp', 'visita', 'email'][Math.floor(Math.random() * 4)],
          ['Llamada de seguimiento', 'Mensaje de WhatsApp', 'Visita al cliente', 'Email de actualización', 'Recordatorio de documentos'][Math.floor(Math.random() * 5)],
          fuDate,
          new Date(fuDate.getTime() + (3 + Math.random() * 14) * 86400000),
          completed,
        ]
      );
      withFollowups++;
    }

    // Documentos (60% de probabilidad)
    if (Math.random() < 0.6) {
      const docTypes = ['cedula_adelante', 'cedula_trasera', 'desprendible', 'formato_consulta', 'comprobante_ingresos'];
      const numDocs = Math.floor(Math.random() * 4) + 1;
      const used = new Set();
      for (let k = 0; k < numDocs; k++) {
        const type = docTypes[Math.floor(Math.random() * docTypes.length)];
        if (used.has(type)) continue;
        used.add(type);
        const docStatus = Math.random() < 0.7 ? 'validado' : (Math.random() < 0.5 ? 'pendiente' : 'rechazado');
        await client.query(
          `INSERT INTO public.documents (credit_id, document_type, file_url, status, uploaded_by, uploaded_at, reviewed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [creditId, type, `/uploads/${creditId}/${type}.pdf`, docStatus, asesor.id, randomDateBetween(createdAt, now), docStatus === 'validado' ? randomDateBetween(createdAt, now) : null]
        );
        withDocs++;
      }
    }
  }

  console.log(`\n✓ Seed completo:`);
  console.log(`  ${inserted} créditos insertados`);
  console.log(`  ${withStatusHistory} entradas de historial`);
  console.log(`  ${withFollowups} seguimientos`);
  console.log(`  ${withDocs} documentos`);

  // Mostrar distribución por estado
  const distRes = await client.query('SELECT status, COUNT(*) as count FROM public.credits GROUP BY status ORDER BY status');
  console.log('\nDistribución por estado:');
  for (const r of distRes.rows) {
    console.log(`  ${r.status.padEnd(20)} ${r.count}`);
  }

  // Distribución por asesor
  const asesorDist = await client.query(`
    SELECT p.full_name, COUNT(c.id) as count
    FROM public.profiles p
    LEFT JOIN public.credits c ON c.asesor_id = p.id
    WHERE p.role = 'asesor'
    GROUP BY p.full_name
    ORDER BY count DESC
  `);
  console.log('\nDistribución por asesor:');
  for (const r of asesorDist.rows) {
    console.log(`  ${r.full_name.padEnd(25)} ${r.count}`);
  }

  // Total colocado
  const totalRes = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'desembolsado') as desembolsados,
      COALESCE(SUM(approved_amount) FILTER (WHERE status = 'desembolsado'), 0) as total_desembolsado,
      COUNT(*) as total
    FROM public.credits
  `);
  console.log('\nTotales:');
  console.log(`  Total créditos:        ${totalRes.rows[0].total}`);
  console.log(`  Desembolsados:         ${totalRes.rows[0].desembolsados}`);
  console.log(`  Colocado:              $${Number(totalRes.rows[0].total_desembolsado).toLocaleString('es-CO')}`);

  await client.end();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});