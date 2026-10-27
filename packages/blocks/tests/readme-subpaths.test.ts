// @vitest-environment node
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const packageJson = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')) as {
  exports: Record<string, unknown>;
};
const readme = readFileSync(join(PACKAGE, 'README.md'), 'utf8');
const docsPages = readdirSync(join(PACKAGE, 'docs')).filter((name) => name.endsWith('.md'));

describe('README subpath coverage', () => {
  it('mentions every export subpath; links every docs page', () => {
    {
      // mentions every export subpath
      const publicNames = Object.keys(packageJson.exports)
        .filter((key) => key !== '.')
        .map((key) => `@texuli/blocks${key.slice(1)}`);
      expect(publicNames.filter((name) => !readme.includes(name))).toEqual([]);
    }
    // links every docs page
    expect(docsPages.filter((page) => !readme.includes(`docs/${page}`))).toEqual([]);
  });
});
