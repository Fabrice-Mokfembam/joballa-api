/** @typedef {import('@prisma/client').DepartmentCategory} DepartmentCategory */

/**
 * Canonical employer-facing departments — one active row per category.
 * Stable UUIDs for dev/staging; upsert by `slug`.
 */
export const DEPARTMENTS_SEED = [
  {
    id: '11111111-1111-4111-8111-111111110001',
    name: 'Education',
    slug: 'education',
    category: 'EDUCATION',
    description: 'Teaching, tutoring, school support',
    isActive: true,
  },
  {
    id: '11111111-1111-4111-8111-111111110002',
    name: 'Domestic work',
    slug: 'domestic',
    category: 'DOMESTIC',
    description: 'Housekeeping, childcare, home support',
    isActive: true,
  },
  {
    id: '11111111-1111-4111-8111-111111110003',
    name: 'Logistics & delivery',
    slug: 'logistics',
    category: 'LOGISTICS',
    description: 'Drivers, warehouse, last-mile delivery',
    isActive: true,
  },
  {
    id: '11111111-1111-4111-8111-111111110004',
    name: 'Events & hospitality',
    slug: 'events',
    category: 'EVENTS',
    description: 'Catering, events, hotel staff',
    isActive: true,
  },
  {
    id: '11111111-1111-4111-8111-111111110005',
    name: 'Agriculture',
    slug: 'agriculture',
    category: 'AGRICULTURE',
    description: 'Farming, agro-processing, field work',
    isActive: true,
  },
  {
    id: '11111111-1111-4111-8111-111111110006',
    name: 'Construction',
    slug: 'construction',
    category: 'CONSTRUCTION',
    description: 'Building, trades, site work',
    isActive: true,
  },
  {
    id: 'ae761000-7002-4136-bf74-e5aabe5ae799',
    name: 'Software & technology',
    slug: 'software-tech',
    category: 'SOFTWARE_TECH',
    description: 'Engineering, design, IT',
    isActive: true,
  },
  {
    id: '11111111-1111-4111-8111-111111110099',
    name: 'Other',
    slug: 'other',
    category: 'OTHER',
    description: 'Categories not listed above',
    isActive: true,
  },
];

/** UUID kept for existing jobs that referenced integration-smoke department. */
export const LEGACY_SOFTWARE_TECH_ID = 'ae761000-7002-4136-bf74-e5aabe5ae799';
