import { PrismaClient } from '@prisma/client';

// Singleton para evitar multiples instancias en dev
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from '@prisma/client';
// Export de VALOR (no `export type`): el dispatcher usa `new Prisma.Decimal(...)`
// en runtime — con export type se borra al compilar y crashea con
// "Prisma is not defined".
export { Prisma } from '@prisma/client';
