import { prisma } from '../index.js';
import { seedExercises } from './exercises.js';

async function main() {
  console.log('🌱 Seeding...');

  await seedExercises();

  console.log('✅ Seed complete');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
