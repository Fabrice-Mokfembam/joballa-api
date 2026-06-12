/** @type {boolean} */
export let failed = false;

export function resetFailed() {
  failed = false;
}

export function fail(step, detail) {
  failed = true;
  console.error(`FAIL — ${step}`);
  if (detail !== undefined) console.error(detail);
}

export function ok(step) {
  console.log(`OK   — ${step}`);
}

/**
 * @param {boolean} cond
 * @param {string} step
 * @param {unknown} [detail]
 */
export function assert(cond, step, detail) {
  if (!cond) fail(step, detail);
  else ok(step);
}

export function skip(step, reason) {
  console.log(`SKIP — ${step}${reason ? `: ${reason}` : ''}`);
}

export function exitCode() {
  return failed ? 1 : 0;
}
