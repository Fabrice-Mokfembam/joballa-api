#!/usr/bin/env node
import { loadRootDotenvOptional } from './lib/dotenv-lite.mjs';
import { getPrisma, disconnectPrisma } from './worker-portal/lib/prisma.mjs';
import {
  DEPARTMENTS_SEED,
  LEGACY_SOFTWARE_TECH_ID,
} from '../prisma/departments-seed-data.mjs';

loadRootDotenvOptional();

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function seedDepartments(prisma) {
  const legacy = await prisma.department.findUnique({
    where: { id: LEGACY_SOFTWARE_TECH_ID },
  });
  if (legacy && legacy.slug !== 'software-tech') {
    await prisma.department.update({
      where: { id: LEGACY_SOFTWARE_TECH_ID },
      data: {
        slug: 'software-tech',
        name: 'Software & technology',
        category: 'SOFTWARE_TECH',
        description: 'Engineering, design, IT',
        isActive: true,
      },
    });
    console.log(
      `Updated legacy department ${legacy.slug} → software-tech (${LEGACY_SOFTWARE_TECH_ID})`,
    );
  }

  for (const row of DEPARTMENTS_SEED) {
    const saved = await prisma.department.upsert({
      where: { slug: row.slug },
      create: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        category: row.category,
        description: row.description,
        isActive: row.isActive,
      },
      update: {
        name: row.name,
        category: row.category,
        description: row.description,
        isActive: row.isActive,
      },
    });
    console.log(`  ${saved.slug} (${saved.category}) → ${saved.id}`);
  }

  const canonicalSlugs = DEPARTMENTS_SEED.map((d) => d.slug);
  const deactivated = await prisma.department.updateMany({
    where: { slug: { notIn: canonicalSlugs } },
    data: { isActive: false },
  });
  if (deactivated.count > 0) {
    console.log(`Deactivated ${deactivated.count} non-canonical department(s).`);
  }

  const active = await prisma.department.findMany({
    where: { isActive: true },
    select: { slug: true, category: true },
    orderBy: { slug: 'asc' },
  });
  const categories = new Set(active.map((d) => d.category.toLowerCase()));
  const canonical = DEPARTMENTS_SEED.map((d) => d.category.toLowerCase());
  for (const cat of canonical) {
    if (!categories.has(cat)) {
      console.warn(`Warning: no active department for category ${cat}`);
    }
  }
}

import { pathToFileURL } from 'url';

async function main() {
  const prisma = getPrisma();
  console.log('Seeding canonical departments…');
  await seedDepartments(prisma);
  console.log('Done.');
  await disconnectPrisma();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
