import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const url = process.env.DIRECT_DB_URL?.trim() || process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const tables = await prisma.$queryRaw`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name`;

const enums = await prisma.$queryRaw`
  SELECT t.typname FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typtype = 'e'
  ORDER BY t.typname`;

console.log('tables:', tables.map((r) => r.table_name).join(', '));
console.log('enums:', enums.map((r) => r.typname).join(', '));

await prisma.$disconnect();
