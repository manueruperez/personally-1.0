import { prisma } from '../index.js';

const phone = process.env.PHONE ?? '+573177807831';

async function main() {
  const client = await prisma.client.findFirst({ where: { phone } });
  if (!client) {
    console.log('Cliente no encontrado');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const session = await prisma.session.findFirst({
    where: { clientId: client.id, scheduledDate: today },
    include: {
      logs: {
        orderBy: { orderInSession: 'asc' },
        include: { exercise: { select: { nameEs: true } } },
      },
      planDay: {
        include: {
          items: {
            orderBy: [{ block: 'asc' }, { orderIndex: 'asc' }],
            include: { exercise: { select: { nameEs: true } } },
          },
        },
      },
    },
  });

  if (!session) {
    console.log('⚠️  No hay sesion para hoy');
    return;
  }

  console.log(`\nSesion: ${session.id}`);
  console.log(`Status: ${session.status}`);
  console.log(`Items: total=${session.itemsTotal} done=${session.itemsDone} skipped=${session.itemsSkipped}`);
  console.log(`PlanDay: ${session.planDayId} (${session.planDay.items.length} items)`);
  console.log('\nLogs:');
  for (const l of session.logs) {
    console.log(
      `  ${l.orderInSession}. [${l.status.padEnd(10)}] ${l.exercise.nameEs}`,
    );
  }
  console.log('\nItems del plan_day:');
  for (const i of session.planDay.items) {
    console.log(`  [${i.block.padEnd(8)}] ${i.orderIndex} ${i.exercise.nameEs}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
