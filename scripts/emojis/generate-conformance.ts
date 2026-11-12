import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findEmojis,
  parseEmojiTokens,
  toShortcodes,
  toUnicode,
} from '../../packages/emojis/src/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'tests/fixtures/emojis/conformance.json');
const point = (value: number): string => String.fromCodePoint(value);
const family = [0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467, 0x200d, 0x1f466].map(point).join('');
const cases = [
  { name: 'mixed-text-and-shortcodes', input: 'Hi :thumbs_up: there :not_a_texuli_shortcode:!' },
  { name: 'supplementary-offsets', input: `A ${point(0x1f600)} B` },
  { name: 'zwj-longest-match', input: `family ${family} end` },
  { name: 'modifier-sequence', input: point(0x1f44d) + point(0x1f3fd) },
  { name: 'flag-sequence', input: point(0x1f1fa) + point(0x1f1f8) },
  { name: 'keycap-sequence', input: '1\ufe0f\u20e3' },
  { name: 'heart-presentation', input: point(0x2764) + point(0xfe0f) },
  { name: 'unqualified-heart', input: point(0x2764) },
  { name: 'canonical-only-shortcode', input: ':thumbs_up: :thumbsup: :+1:' },
  { name: 'repeated-and-adjacent', input: `${point(0x1f600)}${point(0x1f600)}:grinning:` },
  { name: 'malformed-shortcodes', input: ':UPPER: :two words: :unterminated' },
  { name: 'empty', input: '' },
].map((item) => ({
  ...item,
  matches: findEmojis(item.input),
  tokens: parseEmojiTokens(item.input),
  toUnicode: toUnicode(item.input),
  toShortcodes: toShortcodes(item.input),
}));
const document = `${JSON.stringify(
  {
    schemaVersion: 'texuli-emoji-conformance/v1',
    generatedBy: 'packages/emojis/src/index.ts',
    offsetUnit: 'UTF-16 code units',
    cases,
  },
  null,
  2
)}\n`;

const check = process.argv.includes('--check');
if (process.argv.slice(2).some((arg) => arg !== '--check'))
  throw new Error('usage: generate-conformance.ts [--check]');
let existing = '';
try {
  existing = readFileSync(OUTPUT, 'utf8');
} catch {
  /* create below */
}
if (existing !== document) {
  if (check)
    throw new Error(
      'emoji conformance fixture is stale; run scripts/emojis/generate-conformance.ts'
    );
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, document);
}
console.log(
  `${check ? 'checked' : 'generated'} ${cases.length} emoji conformance cases from the web engine`
);
