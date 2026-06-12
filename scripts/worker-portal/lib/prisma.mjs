import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/** @type {PrismaClient | null} */
let client = null;

export function getPrisma() {
  if (client) return client;
  const connectionString =
    process.env.DIRECT_DB_URL?.trim() || process.env.DATABASE_URL;
  if (!connectionString?.trim()) {
    throw new Error('DATABASE_URL is required for worker test seeding.');
  }
  const adapter = new PrismaPg({ connectionString });
  client = new PrismaClient({ adapter });
  return client;
}

export async function disconnectPrisma() {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
