import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gitCommitDateUtc } from '../src/components/seo/integration.ts';

/*
 * Sitemap lastmod (T-100 P2-2): the gates compare lastmod against UTC, so the
 * date must be the commit's UTC calendar day, not the committer's local one.
 * A commit at 01:00 on 10-27 in +05:30 is 19:30 UTC on 10-26.
 */

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
    execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], {
      cwd: repo,
      env,
      stdio: 'pipe',
    });
  git('init', '-q');
  writeFileSync(join(repo, 'page.astro'), '---\n---\n');
  git('add', 'page.astro');
  git('commit', '-q', '-m', 'fixture');
});

afterAll(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
});

describe('gitCommitDateUtc', () => {
  it('reports the UTC day of a commit made just after midnight in +05:30', () => {
    expect(gitCommitDateUtc(['--', 'page.astro'], repo)).toBe('2026-10-26');
  });

  it('reports the UTC day for HEAD too', () => {
    expect(gitCommitDateUtc([], repo)).toBe('2026-10-26');
  });
});
