/**
 * True when the module at `metaUrl` is the process entry. npm, pnpm and npx
 * start a bin through a `node_modules/.bin` symlink, so `process.argv[1]` is
 * the link while `import.meta.url` is the real file: both sides go through
 * `realpathSync` before they are compared.
 */
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function realPath(path: string): string {
  const resolved = resolve(path);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

export function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realPath(fileURLToPath(metaUrl)) === realPath(entry);
  } catch {
    return false;
  }
}
