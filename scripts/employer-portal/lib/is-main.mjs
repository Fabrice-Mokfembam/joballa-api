import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/** True when this file was executed directly (`node scripts/employer-portal/01-session.mjs`). */
export function isMain(importMetaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    const modulePath = fileURLToPath(importMetaUrl);
    const entryPath = fileURLToPath(
      entry.startsWith('file:') ? entry : pathToFileURL(resolve(entry)),
    );
    return modulePath === entryPath;
  } catch {
    return false;
  }
}
