import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { compile } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../src');
const LOOKS = { data: 'grid', ruled: 'ruled', mini: 'mini' } as const;
const sheet = (name: string) => readFileSync(join(SRC, `table/${name}.css`), 'utf8');

function svelteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return svelteFiles(path);
    return entry.name.endsWith('.svelte') ? [path] : [];
  });
}

// Every family component that renders the <details> data-table fallback.
const FALLBACKS = svelteFiles(SRC).filter((file) =>
  /<details class="tx-chart-(data|ruled|mini)\b/.test(readFileSync(file, 'utf8'))
);

describe('shared data-table fallback styles', () => {
  it('covers every chart family that renders a <details> table', () => {
    const withDetails = svelteFiles(SRC).filter((file) =>
      readFileSync(file, 'utf8').includes('<details')
    );
    expect(FALLBACKS.length).toBeGreaterThanOrEqual(15);
    expect(FALLBACKS.map((file) => relative(SRC, file)).sort()).toEqual(
      withDetails.map((file) => relative(SRC, file)).sort()
    );
  });

  it('imports the shared stylesheet of its look and keeps no scoped copy of the table rules', () => {
    for (const file of FALLBACKS) {
      const source = readFileSync(file, 'utf8');
      const look = /<details class="tx-chart-(data|ruled|mini)\b/.exec(
        source
      )?.[1] as keyof typeof LOOKS;
      expect(source, relative(SRC, file)).toContain(`import '../table/${LOOKS[look]}.css'`);
      if (source.includes('data-depth=')) {
        expect(source, relative(SRC, file)).toContain("import '../table/depth.css'");
      }
      const css =
        compile(source, { filename: relative(SRC, file), css: 'external' }).css?.code ?? '';
      expect(css, relative(SRC, file)).not.toMatch(/border-collapse/);
      expect(css, relative(SRC, file)).not.toMatch(/data-depth/);
    }
    const frame = readFileSync(join(SRC, 'matrix/MatrixFrame.svelte'), 'utf8');
    expect(frame).not.toMatch(/:global\((table|th|td|\.data-table)/);
  });

  it('keeps the family tap-target summary row and logical properties', () => {
    for (const look of ['grid', 'ruled']) {
      expect(sheet(look), look).toMatch(/> summary \{[^}]*min-block-size: 2\.75rem/);
    }
    for (const look of ['grid', 'ruled', 'mini', 'depth']) {
      expect(sheet(look), look).not.toMatch(
        /(?:^|[\s;{])(left|right|width|height|margin-top|padding-left)\s*:/m
      );
    }
  });
});
