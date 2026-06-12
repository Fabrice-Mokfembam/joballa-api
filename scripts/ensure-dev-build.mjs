/**
 * Before `nest start --watch`: if dist is incomplete, clear incremental cache
 * so tsc re-emits all entry files (avoids missing dist/main.js or dist/instrument.js).
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const requiredDistFiles = ['dist/main.js', 'dist/instrument.js'];
const missing = requiredDistFiles.filter((rel) => !fs.existsSync(path.join(root, rel)));

if (missing.length > 0) {
  for (const p of ['dist', 'tsconfig.build.tsbuildinfo']) {
    fs.rmSync(path.join(root, p), { recursive: true, force: true });
  }
}
