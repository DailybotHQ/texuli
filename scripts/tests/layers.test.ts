// @vitest-environment node
import { cpSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  checkWorkspace,
  importsOf,
  LAYERS,
  maskCode,
  packageNameOf,
  RULES,
  run,
  splitSvelte,
} from '../check-layers.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const FIXTURES = resolve(import.meta.dirname, 'fixtures/layers');
const temps: string[] = [];

afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

/** Copies a fixture workspace to a temp dir and drops every `.fixture` suffix. */
function materialize(name: 'clean' | 'violations'): string {
  const dir = mkdtempSync(join(tmpdir(), `texuli-layers-${name}-`));
  temps.push(dir);
  cpSync(join(FIXTURES, name), dir, { recursive: true });
  const unsuffix = (folder: string) => {
    for (const entry of readdirSync(folder)) {
      const path = join(folder, entry);
      if (statSync(path).isDirectory()) unsuffix(path);
      else if (entry.endsWith('.fixture')) renameSync(path, path.slice(0, -'.fixture'.length));
    }
  };
  unsuffix(dir);
  return dir;
}

describe('maskCode', () => {
  it('blanks comments and keeps newlines and offsets', () => {
    const source = 'a // eval(x)\n/* {@html}\n */ b';
    const masked = maskCode(source, { strings: false });
    expect(masked).toHaveLength(source.length);
    expect(masked.split('\n')).toHaveLength(3);
    expect(masked).not.toContain('eval');
    expect(masked).not.toContain('@html');
    expect(masked).toContain('a');
    expect(masked.trimEnd().endsWith('b')).toBe(true);
  });

  it('blanks string and template text but keeps template expressions', () => {
    // The source text holds a template literal with a `${...}` expression.
    const source = "x('eval(a)'); y(`new Function($" + '{eval(b)})`)';
    const masked = maskCode(source, { strings: true });
    expect(masked).not.toContain('eval(a)');
    expect(masked).not.toContain('new Function');
    expect(masked).toContain('eval(b)');
  });

  it('keeps strings when only comments are masked (import specifiers)', () => {
    expect(maskCode("import x from '@protoyard/ui'; // 'dexie'", { strings: false })).toContain(
      "'@protoyard/ui'"
    );
  });
});

describe('importsOf and packageNameOf', () => {
  it('ignores import text inside string literals but keeps real imports', () => {
    const code = [
      'const row = { from: "import { Button } from \'@protoyard/ui\'" };',
      'const tpl = `export * from "@protoyard/ui"`;',
      "import { Dialog } from '@texuli/primitives/dialog';",
    ].join('\n');
    expect(importsOf(code).map((site) => site.specifier)).toEqual(['@texuli/primitives/dialog']);
  });

  it('finds static, re-export, type, side-effect, dynamic and require imports', () => {
    const code = [
      "import a from 'a';",
      "import type { B } from '@s/b/sub';",
      "import {\n  c,\n  d,\n} from 'c';",
      "import 'side-effect';",
      "export * from 'e';",
      "export { f } from 'f';",
      "const g = () => import('g');",
      "const h = require('h');",
    ].join('\n');
    expect(importsOf(code).map((site) => site.specifier)).toEqual([
      'a',
      '@s/b/sub',
      'c',
      'side-effect',
      'e',
      'f',
      'g',
      'h',
    ]);
  });

  it('reads package names from specifiers', () => {
    expect(packageNameOf('@texuli/core/src/x.ts')).toBe('@texuli/core');
    expect(packageNameOf('texuli/button')).toBe('texuli');
    expect(packageNameOf('dexie')).toBe('dexie');
  });
});

describe('splitSvelte', () => {
  it('separates the script from the markup and drops styles and HTML comments', () => {
    const source =
      '<script lang="ts">\n  import x from "y";\n</script>\n<!-- {@html a} -->\n<p>{x}</p>\n<style>\n  p { color: red; }\n</style>';
    const { script, markup } = splitSvelte(source);
    expect(script).toHaveLength(source.length);
    expect(markup).toHaveLength(source.length);
    expect(script).toContain('import x from "y"');
    expect(script).not.toContain('<p>');
    expect(markup).toContain('<p>{x}</p>');
    expect(markup).not.toContain('import');
    expect(markup).not.toContain('@html');
    expect(markup).not.toContain('color: red');
  });
});

describe('the layer table', () => {
  it('orders the layers down from the tools to core', () => {
    const order = [
      '@texuli/core',
      '@texuli/primitives',
      '@texuli/tokens',
      'texuli',
      '@texuli/charts',
      '@texuli/blocks',
      '@texuli/catalog',
      '@texuli/tools',
    ];
    const layers = order.map((name) => LAYERS[name]);
    expect(layers).toEqual([...layers].sort((a = 0, b = 0) => a - b));
    expect(LAYERS['@texuli/charts']).toBe(LAYERS['@texuli/data']);
    expect(LAYERS['@texuli/charts']).toBe(LAYERS['@texuli/media']);
  });
});

describe('checkWorkspace', () => {
  it('passes on the Texuli repository', () => {
    expect(checkWorkspace(ROOT)).toEqual([]);
  });

  it('passes on the clean fixture: banned words in comments and strings, dynamic styles', () => {
    expect(checkWorkspace(materialize('clean'))).toEqual([]);
  });

  it('rejects every banned pattern in the violations fixture, at its line', () => {
    const findings = checkWorkspace(materialize('violations'));
    const summary = findings.map((f) => `${f.file}:${f.line} ${f.rule}`);
    expect(summary).toEqual([
      'packages/charts/package.json:0 layer',
      'packages/charts/src/index.ts:1 layer',
      'packages/core/package.json:0 banned-dependency',
      'packages/core/package.json:0 banned-dependency',
      'packages/core/package.json:0 layer',
      'packages/core/src/index.ts:1 layer',
      'packages/mystery/package.json:0 unknown-layer',
      'packages/primitives/package.json:0 banned-dependency',
      'packages/primitives/src/Sinks.svelte:5 html-sink',
      'packages/primitives/src/Sinks.svelte:5 static-style',
      'packages/primitives/src/Sinks.svelte:6 code-sink',
      'packages/primitives/src/Sinks.svelte:6 static-style',
      'packages/primitives/src/banned.ts:1 banned-import',
      'packages/primitives/src/banned.ts:2 banned-import',
      'packages/primitives/src/banned.ts:4 banned-import',
      'packages/primitives/src/banned.ts:5 banned-import',
      'packages/primitives/src/deep.ts:1 deep-import',
      'packages/primitives/src/deep.ts:2 deep-import',
      'packages/primitives/src/deep.ts:3 deep-import',
      'packages/primitives/src/sinks.ts:2 html-sink',
      'packages/primitives/src/sinks.ts:3 html-sink',
      'packages/primitives/src/sinks.ts:4 html-sink',
      'packages/primitives/src/sinks.ts:5 code-sink',
      'packages/primitives/src/sinks.ts:6 code-sink',
    ]);
    // Every rule the guard knows is exercised by the fixture.
    expect(new Set(findings.map((f) => f.rule))).toEqual(new Set(RULES));
  });

  it('names the banned package and the layers in its messages', () => {
    const messages = checkWorkspace(materialize('violations')).map((f) => f.message);
    expect(messages).toContainEqual(expect.stringContaining('@protoyard/*'));
    expect(messages).toContainEqual(expect.stringContaining('dexie'));
    expect(messages).toContainEqual(expect.stringContaining('@faker-js/*'));
    expect(messages).toContainEqual(
      '@texuli/charts (L4) imports @texuli/data (L4): dependencies point down only'
    );
  });
});

describe('run (CLI)', () => {
  it('exits 0 on a clean workspace, 1 with findings, 2 on a bad argument', () => {
    const lines: string[] = [];
    const out = (text: string) => lines.push(text);
    expect(run(['--root', materialize('clean')], out)).toBe(0);
    expect(run(['--root', materialize('violations')], out)).toBe(1);
    expect(lines.at(-1)).toMatch(/24 finding\(s\)/);
    expect(run(['--nope'], out)).toBe(2);
  });

  it('prints JSON with --json', () => {
    let printed = '';
    run(['--root', materialize('violations'), '--json'], (text) => {
      printed = text;
    });
    const report = JSON.parse(printed) as { ok: boolean; findings: unknown[] };
    expect(report.ok).toBe(false);
    expect(report.findings).toHaveLength(24);
  });
});
