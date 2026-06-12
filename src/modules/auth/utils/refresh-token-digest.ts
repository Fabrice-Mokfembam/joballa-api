import { createHash } from 'crypto';

/** Stable lookup for opaque refresh UUID (bcrypt hashes are not keyed for lookups). */
export function digestOpaqueToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}
