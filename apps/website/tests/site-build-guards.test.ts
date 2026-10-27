// @vitest-environment node
/**
 * Build-time guards of the site:
 * - JSON-LD serialization cannot break out of its script element (S-7);
 * - sitemap lastmod is the commit's UTC day, not the committer's (T-100 P2-2);
 * - `src/pages` holds routes only: Astro treats every `.ts` file there as an
 *   endpoint, so a helper without a GET handler becomes a stray route;
 * - the page CSP names the `texuli-analytics` Trusted Types policy only on
 *   pages that mount the Umami loader (T-100 S-1);
 * - the skill pack is published from its SHA256SUMS allowlist only (S-8).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ANALYTICS_TRUSTED_TYPES_POLICY, pagePolicy } from '../src/components/security/csp.ts';
import { gitCommitDateUtc } from '../src/components/seo/integration.ts';
import { serializeJsonLd } from '../src/components/seo/json-ld.ts';
import { publishSkillPack } from '../src/integrations/skill-pack.ts';

const temps: string[] = [];
function temp(prefix = 'texuli-site-guard-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('serializeJsonLd (S-7)', () => {
  it('cannot close the script element, open a comment, or carry &, U+2028 and U+2029', () => {
    const out = serializeJsonLd({
      name: '</script><script>alert(1)</script>',
      note: '<!-- x -->',
      a: 'Tom & Jerry',
      b: 'x\u2028y\u2029z',
    });
    expect(out).not.toMatch(/[<>&\u2028\u2029]/);
    expect(out.toLowerCase()).not.toContain('</script');
    for (const escaped of ['\\u003c/script\\u003e', '\\u0026', '\\u2028', '\\u2029']) {
      expect(out, escaped).toContain(escaped);
    }
  });

  it('round-trips through JSON.parse and leaves plain data byte-identical to JSON.stringify', () => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'A </script> & <b> title \u2028 here',
      list: [1, true, null, { url: 'https://example.com/?a=1&b=2' }],
    };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
    const plain = { '@type': 'Organization', name: 'Texuli', url: 'https://texuli.com' };
    expect(serializeJsonLd(plain)).toBe(JSON.stringify(plain));
  });
});

describe('gitCommitDateUtc (T-100 P2-2)', () => {
  // A commit at 01:00 on 10-27 in +05:30 is 19:30 UTC on 10-26.
  let repo = '';
  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'texuli-lastmod-'));
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: 'Example',
      GIT_AUTHOR_EMAIL: 'dev@example.com',
      GIT_COMMITTER_NAME: 'Example',
      GIT_COMMITTER_EMAIL: 'dev@example.com',
      GIT_AUTHOR_DATE: '2026-10-27T01:00:00+05:30',
      GIT_COMMITTER_DATE: '2026-10-27T01:00:00+05:30',
    };
    const git = (...args: string[]) =>
      execFileSync(
        'git',
        ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args],
        { cwd: repo, env, stdio: 'pipe' }
      );
    git('init', '-q');
    writeFileSync(join(repo, 'page.astro'), '---\n---\n');
    git('add', 'page.astro');
    git('commit', '-q', '-m', 'fixture');
  });
  afterAll(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
  });

  it('reports the UTC day of a commit made just after midnight in +05:30, for a path and HEAD', () => {
    expect(gitCommitDateUtc(['--', 'page.astro'], repo)).toBe('2026-10-26');
    expect(gitCommitDateUtc([], repo)).toBe('2026-10-26');
  });
});

describe('src/pages holds routes only', () => {
  const pagesRoot = join(import.meta.dirname, '..', 'src', 'pages');
  function tsFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name.startsWith('_') ? [] : tsFiles(path);
      return entry.name.endsWith('.ts') && !entry.name.startsWith('_') ? [path] : [];
    });
  }

  it('every .ts module under src/pages exports a GET handler', () => {
    const handlerless = tsFiles(pagesRoot)
      .filter(
        (file) =>
          !/export\s+(const|async\s+function|function)\s+GET\b/.test(readFileSync(file, 'utf8'))
      )
      .map((file) => relative(pagesRoot, file));
    expect(handlerless).toEqual([]);
  });
});

describe('pagePolicy trusted-types (T-100 S-1)', () => {
  const MOUNT =
    '<script src="/umami-loader.js" data-umami-loader data-script-src="/api/umami/script.js" data-website-id="fixture-id" data-host-url="/api/umami" defer></script>';
  const directive = (policy: string, name: string): string | undefined =>
    policy
      .split('; ')
      .find((entry) => entry.startsWith(`${name} `))
      ?.slice(name.length + 1);

  it('allows only svelte-trusted-html without the mount, even when the marker is escaped text', () => {
    for (const html of [
      '<!doctype html><html><head></head><body><p>Hi</p></body></html>',
      '<!doctype html><html><body><pre>&lt;script data-umami-loader&gt;</pre></body></html>',
    ]) {
      expect(directive(pagePolicy(html), 'trusted-types'), html).toBe('svelte-trusted-html');
    }
  });

  it('adds exactly the texuli-analytics policy on a page that mounts the loader, nothing broader', () => {
    const policy = pagePolicy(`<!doctype html><html><head>${MOUNT}</head><body></body></html>`);
    expect(ANALYTICS_TRUSTED_TYPES_POLICY).toBe('texuli-analytics');
    expect(directive(policy, 'trusted-types')).toBe('svelte-trusted-html texuli-analytics');
    expect(directive(policy, 'require-trusted-types-for')).toBe("'script'");
    expect(directive(policy, 'script-src')).toBe("'self'");
    expect(policy).not.toContain("'allow-duplicates'");
  });
});

describe('publishSkillPack (S-8)', () => {
  const PACK = fileURLToPath(new URL('../../../skills/texuli', import.meta.url));
  const listed = (pack: string): string[] =>
    readFileSync(join(pack, 'SHA256SUMS'), 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => line.replace(/^[0-9a-f]{64}\s+\*?/, ''));
  const filesUnder = (dir: string, base = dir): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? filesUnder(full, base) : [full.slice(base.length + 1)];
    });

  it('publishes exactly the SHA256SUMS files, never an untracked extra, with matching digests', () => {
    const pack = join(temp(), 'texuli');
    cpSync(PACK, pack, { recursive: true });
    writeFileSync(join(pack, 'secret-notes.md'), 'not for publication\n');
    mkdirSync(join(pack, '.cache'), { recursive: true });
    writeFileSync(join(pack, '.cache', 'scratch.json'), '{}\n');
    writeFileSync(join(pack, 'router', 'draft.md'), 'draft\n');

    const served = join(temp(), 'skill-pack');
    const published = publishSkillPack(pack, served);

    const expected = [...listed(pack), 'SHA256SUMS'].sort();
    expect(filesUnder(served).sort()).toEqual(expected);
    expect(published.sort()).toEqual(expected);
    expect(existsSync(join(served, 'secret-notes.md'))).toBe(false);
    expect(existsSync(join(served, '.cache'))).toBe(false);
    expect(existsSync(join(served, 'router', 'draft.md'))).toBe(false);
    for (const line of readFileSync(join(served, 'SHA256SUMS'), 'utf8').split('\n')) {
      const match = /^([0-9a-f]{64})\s+\*?(.+)$/.exec(line);
      if (!match?.[1] || !match[2]) continue;
      expect(readFileSync(join(served, match[2]))).toEqual(readFileSync(join(pack, match[2])));
      const digest = createHash('sha256')
        .update(readFileSync(join(served, match[2])))
        .digest('hex');
      expect(digest, match[2]).toBe(match[1]);
    }
  });

  it('refuses an entry that escapes the pack and fails when a listed file is missing', () => {
    const root = temp();
    const escaping = join(root, 'texuli');
    mkdirSync(escaping, { recursive: true });
    writeFileSync(join(root, 'outside.txt'), 'outside\n');
    writeFileSync(join(escaping, 'SHA256SUMS'), `${'0'.repeat(64)}  ../outside.txt\n`);
    const served = join(temp(), 'skill-pack');
    expect(() => publishSkillPack(escaping, served)).toThrow(/outside the pack/);
    expect(existsSync(join(dirname(served), 'outside.txt'))).toBe(false);

    const missing = join(temp(), 'texuli');
    mkdirSync(missing, { recursive: true });
    writeFileSync(join(missing, 'SHA256SUMS'), `${'0'.repeat(64)}  SKILL.md\n`);
    expect(() => publishSkillPack(missing, join(temp(), 'skill-pack'))).toThrow(/SKILL\.md/);
  });
});
