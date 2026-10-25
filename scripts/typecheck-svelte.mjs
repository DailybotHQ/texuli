#!/usr/bin/env node
// Type-check a Svelte package strictly (warnings fail). svelte-check reports a
// package with no .svelte files yet as a warning, so until the first component
// lands, the package's TypeScript is checked with tsc instead.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

function hasSvelte(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory() ? hasSvelte(path) : entry.name.endsWith('.svelte')) return true;
  }
  return false;
}

const svelte = ['src', 'tests'].some((d) => {
  try {
    return hasSvelte(join(process.cwd(), d));
  } catch {
    return false;
  }
});
const [cmd, args] = svelte
  ? ['svelte-check', ['--tsconfig', './tsconfig.json', '--fail-on-warnings']]
  : ['tsc', ['-p', 'tsconfig.json']];
const result = spawnSync(cmd, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
