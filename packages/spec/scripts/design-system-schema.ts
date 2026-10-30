/**
 * Write `schemas/design-system.schema.json` from the vocabulary table in
 * `src/design-system/vocabulary.ts`, then run the spec generator:
 *   pnpm exec tsx packages/spec/scripts/design-system-schema.ts          (write)
 *   pnpm exec tsx packages/spec/scripts/design-system-schema.ts --check  (fail on drift)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { designSystemSchema } from '../src/design-system/schema.ts';
import { formatJson } from '../src/format.ts';
import { SPEC_ROOT } from './files.ts';

const file = join(SPEC_ROOT, 'schemas/design-system.schema.json');
const text = formatJson(designSystemSchema());
const current = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
if (process.argv.includes('--check')) {
  if (current !== text) {
    console.error('design-system schema drift: run scripts/design-system-schema.ts');
    process.exit(1);
  }
  console.log('checked schemas/design-system.schema.json');
} else {
  if (current !== text) writeFileSync(file, text);
  console.log('wrote schemas/design-system.schema.json');
}
