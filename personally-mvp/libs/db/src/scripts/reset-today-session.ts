import { prisma } from '../index.js';

async function main() {
  const phone = process.env.PHONE ?? '+573177807831';
  const client = await prisma.client.findFirst({ where: { phone } });
  if (!client) {
    console.log('Cliente no encontrado');
    return;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deleted = await prisma.session.deleteMany({
    where: { clientId: client.id, scheduledDate: today },
  });
  console.log(`Sesiones borradas: ${deleted.count}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
