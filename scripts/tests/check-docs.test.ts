// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { anchors, checkCommands, checkDocs, checkLinks, slug } from '../check-docs.ts';
import { commandContext, repositoryRootFromHere } from '../check-skill.ts';

const temp: string[] = [];
afterEach(() => {
  for (const dir of temp.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'texuli-docs-'));
  temp.push(root);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

describe('anchors', () => {
  it('slugs headings the way GitHub does, numbering repeats', () => {
    expect(slug('Quality reports (`docs/quality/`)')).toBe('quality-reports-docsquality');
    expect(slug('L0 core … L7 tools')).toBe('l0-core--l7-tools');
    expect([...anchors('# Intro\n## Usage\n## Usage\n```md\n# Not a heading\n```\n')]).toEqual([
      'intro',
      'usage',
      'usage-1',
    ]);
  });
});

describe('links', () => {
  it('reports missing targets and headings, and skips URLs and site routes', () => {
    const root = repo({ 'docs/b.md': '# Bee\n', 'docs/dir/x.txt': '' });
    const markdown = [
      '[ok](b.md) [ok](b.md#bee) [ok](dir/) [self](#here)',
      '[gone](c.md) [no heading](b.md#wasp) [url](https://example.com/x) [route](/docs/)',
      '`[code](missing.md)`',
      '## Here',
    ].join('\n');
    expect(checkLinks(root, 'docs/a.md', markdown).map((issue) => issue.message)).toEqual([
      'c.md: target does not exist',
      'b.md#wasp: no heading #wasp',
    ]);
  });
});

describe('commands', () => {
  const ctx = commandContext(repositoryRootFromHere());

  it('accepts real scripts, paths, pnpm built-ins, globs and placeholders; reports unknown scripts, packages and files, in fences and inline code', () => {
    // accepts real scripts, paths, pnpm built-ins, globs and placeholders
    {
      const markdown = [
        '```bash',
        'pnpm install',
        'pnpm vitest run packages/core/tests/roving.test.ts',
        'pnpm vitest run packages/primitives/tests/consumer-ids*.test.ts',
        "bash -c 'pnpm build && TEXULI_E2E_PORT=4820 pnpm exec playwright test tests/e2e/csp.spec.ts'",
        'pnpm --filter @texuli/website exec astro check',
        'pnpm --dir tests/fixtures/app exec vite --port 4930',
        'node scripts/anything.mjs   # other tools are not checked',
        '```',
        'Run `pnpm --filter <package> typecheck` or `pnpm size --filter primitives`.',
      ].join('\n');
      expect(checkCommands('doc.md', markdown, ctx)).toEqual([]);
    }
    // reports unknown scripts, packages and files, in fences and inline code
    {
      const markdown = [
        '```sh',
        'pnpm no-such-script',
        'pnpm vitest run packages/core/tests/nope.test.ts',
        '```',
        'Then `pnpm --filter @texuli/nope build`.',
      ].join('\n');
      expect(
        checkCommands('doc.md', markdown, ctx).map(({ line, message }) => [line, message])
      ).toEqual([
        [2, 'pnpm no-such-script: no such root script'],
        [3, 'packages/core/tests/nope.test.ts does not exist in the repository'],
        [5, 'pnpm --filter @texuli/nope: no such workspace package'],
      ]);
    }
  });
});

describe('the repository docs', () => {
  it('have no broken relative link and no unknown command', () => {
    expect(checkDocs(repositoryRootFromHere())).toEqual([]);
  }, 60_000);
});
