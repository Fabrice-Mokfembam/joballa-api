#!/usr/bin/env node
/**
 * Smoke-test all v2 routes documented in newschemaroutes/FRONTEND_*.md
 *
 *   npm run smoke:v2
 *   API_URL=http://127.0.0.1:8000 npm run smoke:v2
 */
import { loadRootDotenvOptional } from '../lib/dotenv-lite.mjs';
import { getBaseUrl } from '../lib/config.mjs';
import { exitCode, failed, resetFailed } from '../worker-portal/lib/assert.mjs';
import { bootstrapV2TestState, teardown } from './lib/bootstrap.mjs';
import { runAuthRouteTests } from './01-auth.mjs';
import { runWorkerRouteTests } from './02-worker.mjs';
import { runEmployerRouteTests } from './03-employer.mjs';

loadRootDotenvOptional();

async function main() {
  resetFailed();
  const base = getBaseUrl();
  console.log(`V2 route smoke tests → ${base}`);

  let state;
  try {
    state = await bootstrapV2TestState();
    await runAuthRouteTests(state);
    await runWorkerRouteTests(state);
    await runEmployerRouteTests(state);
  } finally {
    await teardown();
  }

  if (failed) {
    console.error('\nSome v2 route checks failed. See output above.');
  } else {
    console.log('\nAll v2 route smoke checks passed.');
  }
  process.exit(exitCode());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
