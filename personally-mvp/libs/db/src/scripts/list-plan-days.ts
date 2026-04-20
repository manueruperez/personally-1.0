import { prisma } from '../index.js';

async function main() {
  const phone = process.env.PHONE ?? '+573177807831';
  const client = await prisma.client.findFirst({ where: { phone } });
  if (!client) {
    console.log('Cliente no encontrado');
    return;
  }
  const plan = await prisma.plan.findFirst({
    where: { clientId: client.id, status: 'active' },
    include: {
      weeks: {
        orderBy: { weekNumber: 'asc' },
        take: 1,
        include: {
          days: {
            orderBy: { dayOfWeek: 'asc' },
            include: { items: { select: { block: true } } },
          },
        },
      },
    },
  });
  if (!plan) {
    console.log('Sin plan activo');
    return;
  }
  console.log(`Plan startDate: ${plan.startDate.toISOString().slice(0, 10)}`);
  console.log('Week 1 days:');
  for (const d of plan.weeks[0]?.days ?? []) {
    const name = ['', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'][d.dayOfWeek];
    console.log(
      `  dow=${d.dayOfWeek} (${name}) rest=${d.isRestDay} focus=${d.focus ?? '—'} items=${d.items.length}`,
    );
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
