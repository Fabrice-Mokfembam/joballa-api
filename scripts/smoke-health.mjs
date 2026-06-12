#!/usr/bin/env node
/**
 * Public health check — no auth.
 *
 * Usage:
 *   node scripts/smoke-health.mjs
 *
 * Env:
 *   API_URL — default http://127.0.0.1:PORT or PORT=5000
 */

import { getBaseUrl } from './lib/config.mjs';

const base = getBaseUrl();

const res = await fetch(`${base}/`, { method: 'GET' });

if (!res.ok) {
  console.error(`FAIL: GET ${base}/ → ${res.status} ${res.statusText}`);
  process.exit(1);
}

const html = await res.text();
const hasTitle =
  html.includes('Joballa Backend Terminal') ||
  html.includes('Joballa backend is running'); // tolerant if markup changes slightly

if (!hasTitle) {
  console.warn(
    'WARN: Status page markup may have changed — still got HTTP 200.',
  );
}

console.log(`OK: GET ${base}/ → ${res.status} (HTML length ${html.length})`);
process.exit(0);
