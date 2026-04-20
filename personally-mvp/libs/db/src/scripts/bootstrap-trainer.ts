/**
 * Bootstrap del primer trainer.
 *
 * 1. Crea un usuario en Supabase Auth (con email verificado automaticamente).
 * 2. Crea la Organization (solo_trainer).
 * 3. Crea el Trainer vinculado a auth.users.id.
 *
 * Uso:
 *   BOOTSTRAP_EMAIL=juan@... BOOTSTRAP_NAME="Juan" BOOTSTRAP_PASSWORD=... \
 *   pnpm bootstrap:trainer
 *
 * Es idempotente: si el usuario ya existe en Auth, reutiliza su id.
 * Si ya existe el trainer en DB, hace update de nombre.
 */

import { createClient } from '@supabase/supabase-js';
import { prisma } from '../index.js';

async function main() {
  const email = process.env.BOOTSTRAP_EMAIL;
  const name = process.env.BOOTSTRAP_NAME;
  const password = process.env.BOOTSTRAP_PASSWORD;
  const orgName = process.env.BOOTSTRAP_ORG_NAME ?? `${name ?? 'Trainer'} — Personal`;

  if (!email || !name || !password) {
    console.error('Faltan env vars: BOOTSTRAP_EMAIL, BOOTSTRAP_NAME, BOOTSTRAP_PASSWORD');
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n🔐 Creando usuario en Supabase Auth: ${email}`);
  let userId: string;

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (created.error) {
    // Ya existe: buscarlo
    if (
      created.error.message.toLowerCase().includes('already') ||
      created.error.status === 422 ||
      created.error.code === 'email_exists'
    ) {
      console.log('  ↳ usuario ya existia, buscando id...');
      const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list.data?.users.find((u) => u.email === email);
      if (!existing) {
        console.error('No pude encontrar el usuario existente con ese email');
        process.exit(1);
      }
      userId = existing.id;
    } else {
      console.error('Error creando usuario:', created.error);
      process.exit(1);
    }
  } else {
    userId = created.data.user!.id;
  }

  console.log(`  ↳ userId = ${userId}`);

  // Buscar si ya hay trainer con ese userId
  const existingTrainer = await prisma.trainer.findUnique({
    where: { userId },
    include: { organization: true },
  });

  if (existingTrainer) {
    console.log(`\n👤 Trainer ya existe: ${existingTrainer.name} (${existingTrainer.email})`);
    const updated = await prisma.trainer.update({
      where: { id: existingTrainer.id },
      data: { name },
    });
    console.log(`  ↳ nombre actualizado a "${updated.name}"`);
    console.log(`\n🏢 Organization: ${existingTrainer.organization.name} (${existingTrainer.organization.id})`);
    console.log('\n✅ Todo listo. Podes loguearte en http://localhost:5173/login');
    return;
  }

  console.log(`\n🏢 Creando organization: ${orgName}`);
  const org = await prisma.organization.create({
    data: { name: orgName, type: 'solo_trainer' },
  });
  console.log(`  ↳ organizationId = ${org.id}`);

  console.log(`\n👤 Creando trainer...`);
  const trainer = await prisma.trainer.create({
    data: {
      organizationId: org.id,
      userId,
      role: 'trainer',
      name,
      email,
    },
  });
  console.log(`  ↳ trainerId = ${trainer.id}`);

  console.log('\n✅ Listo. Podes loguearte en http://localhost:5173/login con:');
  console.log(`   email:    ${email}`);
  console.log(`   password: (el que pasaste)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
