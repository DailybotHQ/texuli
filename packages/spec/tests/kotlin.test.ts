// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { KOTLIN_OUT } from '../src/build.ts';
import { kotlinString } from '../src/codegen/kotlin.ts';
import { build } from './helpers.ts';

const kotlin = Object.entries(build.generated).filter(([path]) => path.startsWith(KOTLIN_OUT));

/** Code with string literals and comments blanked, for structure checks (one pass). */
function code(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === '//') {
      while (i < text.length && text[i] !== '\n') i += 1;
    } else if (two === '/*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else if (text[i] === '"') {
      i += 1;
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
      i += 1;
      out += '""';
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

describe('generated Kotlin (text artifacts; no Kotlin toolchain here)', () => {
  it('declares the package, balances its brackets and uses no tabs', () => {
    expect(kotlin).toHaveLength(6);
    for (const [path, text] of kotlin) {
      expect(text, path).toContain('\npackage com.texuli.spec\n');
      expect(text, path).not.toContain('\t');
      const body = code(text);
      for (const [open, close] of [
        ['{', '}'],
        ['(', ')'],
        ['[', ']'],
      ] as const) {
        expect(body.split(open).length, `${path} ${open}`).toBe(body.split(close).length);
      }
    }
  });

  it('defines every type it references', () => {
    const all = kotlin.map(([, text]) => code(text)).join('\n');
    const defined = new Set(
      [...all.matchAll(/(?:class|interface|object|typealias)\s+([A-Z][A-Za-z0-9]*)/g)].map(
        (m) => m[1]
      )
    );
    const builtins = new Set([
      'String',
      'Long',
      'Double',
      'Boolean',
      'List',
      'Map',
      'Set',
      'IllegalArgumentException',
      'JsonValue',
      'Str',
      'Num',
      'Bool',
      'Arr',
      'Obj',
      'Null',
    ]);
    const referenced = [...all.matchAll(/:\s*([A-Z][A-Za-z0-9]*)/g)].map((m) => m[1] as string);
    for (const name of referenced) {
      expect(defined.has(name) || builtins.has(name), name).toBe(true);
    }
  });

  it('decodes closed: every data class rejects unknown fields', () => {
    for (const [path, text] of kotlin) {
      const classes = text.match(/^data class /gm)?.length ?? 0;
      const closed = text.match(/fields\.requireOnly\(FIELDS, path\)/g)?.length ?? 0;
      expect(closed, path).toBe(classes);
    }
  });

  it('escapes string literals', () => {
    expect(kotlinString('Say "hi" for $5\\n')).toBe('"Say \\"hi\\" for \\$5\\\\n"');
  });
});
