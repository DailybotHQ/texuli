import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emojiCatalog } from '../../packages/emojis/src/catalog.ts';
import {
  findEmojis,
  parseEmojiTokens,
  toShortcodes,
  toUnicode,
} from '../../packages/emojis/src/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'tests/fixtures/emojis/conformance.jsonl');
const point = (value: number): string => String.fromCodePoint(value);

// Captured legacy migration inputs: the 27 audited sample rows plus the
// additional mixed-text input in the 28-row bridge parity run.
const legacyInputs = [
  ':rocket:',
  ':tada:',
  ':heart:',
  ':+1:',
  ':thumbsup:',
  ':thumbs_up:',
  ':-1:',
  ':smile:',
  ':unknown_word:',
  ':not_an_emoji:',
  'hello :rocket: world',
  '\u{1f680}',
  '\u{1f389}',
  '\u2764\ufe0f',
  '\u{1f44d}',
  '\u{1f44d}\u{1f3fd}',
  '\u{1f468}\u{200d}\u{1f469}\u{200d}\u{1f467}\u{200d}\u{1f466}',
  '\u{1f1fa}\u{1f1f8}',
  '#\ufe0f\u20e3',
  '1\ufe0f\u20e3',
  '\u2615',
  ':coffee:',
  ':100:',
  '\u{1f4af}',
  'lgtm :+1:',
  'Hello \u{1f60e} :rocket:',
  'mixed :heart: \u{1f680} :unknown_word: end',
  'Ship it :rocket:!',
];

type InputShape =
  | { readonly input: string }
  | { readonly inputUnits: readonly number[] }
  | {
      readonly inputTemplate: {
        readonly prefix: string;
        readonly segment: string;
        readonly repeat: number;
        readonly suffix: string;
      };
    };

function makeCase(
  name: string,
  shape: InputShape,
  input: string,
  compact = false
): Record<string, unknown> {
  const matches = findEmojis(input);
  const unicode = toUnicode(input);
  const shortcodes = toShortcodes(input);
  const roundTrip = toUnicode(shortcodes);
  const base = {
    name,
    ...shape,
    matchCount: matches.length,
    tokenCount: parseEmojiTokens(input).length,
  };
  if (compact) {
    return {
      ...base,
      toUnicodePreservesInput: unicode === input,
      toShortcodesPreservesInput: shortcodes === input,
      roundTripPreservesInput: roundTrip === input,
    };
  }
  return {
    ...base,
    matches,
    tokens: parseEmojiTokens(input),
    toUnicode: unicode,
    toShortcodes: shortcodes,
    roundTrip,
  };
}

const catalogCases = emojiCatalog.records.map((emoji) =>
  makeCase(`catalog:${emoji.id}`, { input: emoji.unicode }, emoji.unicode)
);
const legacyCases = legacyInputs.map((input, index) =>
  makeCase(`legacy:${String(index + 1).padStart(2, '0')}`, { input }, input)
);
const hostileInputs: { name: string; input: string }[] = [
  {
    name: 'mixed-hostile-text',
    input: `before ${point(0x1f469)}\u200d${point(0x1f4bb)} :thumbs_up: :unknown_word: after`,
  },
  { name: 'overlong-shortcode', input: `:${'x'.repeat(200)}:` },
];
const hostileCases = hostileInputs.map(({ name, input }) =>
  makeCase(`hostile:${name}`, { input }, input)
);
for (const [name, codeUnit] of [
  ['lone-high-surrogate', 0xd800],
  ['lone-low-surrogate', 0xdc00],
] as const) {
  const input = String.fromCharCode(codeUnit);
  hostileCases.push(makeCase(`hostile:${name}`, { inputUnits: [codeUnit] }, input, true));
}
const longZwj = `${point(0x1f469)}${`\u200d${point(0x1f469)}`.repeat(2_000)}`;
hostileCases.push(
  makeCase(
    'hostile:long-zwj-chain',
    {
      inputTemplate: {
        prefix: point(0x1f469),
        segment: `\u200d${point(0x1f469)}`,
        repeat: 2_000,
        suffix: '',
      },
    },
    longZwj,
    true
  )
);
const bracketRun = '['.repeat(300_000);
hostileCases.push(
  makeCase(
    'hostile:300kb-text-run',
    { inputTemplate: { prefix: '', segment: '[', repeat: 300_000, suffix: '' } },
    bracketRun,
    true
  )
);

const sanitize = (text: string): string =>
  text.replace(
    /(?:[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]|[\ufe00-\ufe0f]|\u20e3|[\u{e0020}-\u{e007f}])/gu,
    (character) => {
      const value = character.codePointAt(0) ?? 0;
      if (value <= 0xffff) return `\\u${value.toString(16).padStart(4, '0')}`;
      const adjusted = value - 0x10000;
      return `\\u${(0xd800 + (adjusted >> 10)).toString(16)}\\u${(0xdc00 + (adjusted & 0x3ff)).toString(16)}`;
    }
  );
const cases = [...catalogCases, ...legacyCases, ...hostileCases];
const header = {
  schemaVersion: 'texuli-emoji-conformance/v2',
  generatedBy: 'packages/emojis/src/index.ts',
  offsetUnit: 'UTF-16 code units',
  catalogSequences: catalogCases.length,
  legacyInputs: legacyCases.length,
  hostileInputs: hostileCases.length,
  cases: cases.length,
};
const document = `${[header, ...cases].map((value) => sanitize(JSON.stringify(value))).join('\n')}\n`;

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
  `${check ? 'checked' : 'generated'} ${catalogCases.length} catalog, ${legacyCases.length} legacy and ${hostileCases.length} hostile emoji cases`
);
