/**
 * Write tests/fixtures/hostile/corpus.json from HOSTILE_SAMPLES, with bidi and
 * zero-width controls written as JSON escapes (the repository's Trojan Source
 * gate allows no literal controls in tracked files):
 *   pnpm exec tsx packages/catalog/scripts/write-hostile-corpus.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hostileSamplesJson } from '../src/render/hostile/index.ts';

const CONTROLS = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
const text = `${JSON.stringify(hostileSamplesJson(), null, 2)}\n`.replace(
  CONTROLS,
  (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
);
writeFileSync(join(import.meta.dirname, '../../../tests/fixtures/hostile/corpus.json'), text);
console.log('wrote tests/fixtures/hostile/corpus.json');
