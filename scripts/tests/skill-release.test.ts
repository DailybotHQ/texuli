/**
 * The skill release (`.github/workflows/skill-release.yml`, docs/RELEASE.md
 * "Skill release"): the version plan and bump, the changelog stamp, the
 * version sync, the archive and its SHA256SUMS, the workflow's guarantees,
 * and the install commands shared by docs/SKILL_INSTALLATION.md and /skill/.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  installRoutes,
  latestRelease,
  SKILL_TAG_PREFIX,
} from '../../apps/website/src/components/skill/skill.ts';
import {
  applyRelease,
  bumpLevel,
  changelogVersions,
  checkChangelog,
  checkCommand,
  commandContext,
  compareVersions,
  isPinnedNetworkCommand,
  lastSkillTag,
  nextVersion,
  releasePlan,
  repositoryRootFromHere,
  setPackVersion,
  skillVersion,
  stampChangelog,
  verifySkillChecksums,
} from '../check-skill.ts';

const root = repositoryRootFromHere();
const skillRoot = join(root, 'skills', 'texuli');
const scratch: string[] = [];

afterEach(() => {
  while (scratch.length > 0) {
    const dir = scratch.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'texuli-skill-release-'));
  scratch.push(dir);
  return dir;
}

const commit = (subject: string, body = '') => ({ subject, body });

describe('version plan', () => {
  it('bumps from Conventional Commits, 0.x breaking as a minor, and orders SemVer', () => {
    const cases: [string[], string, string, string][] = [
      // [subjects, body, current, next]
      [['fix(skill): typo'], '', '0.2.0', '0.2.1'],
      [['docs: x', 'feat(skill): add upgrade'], '', '0.2.0', '0.3.0'],
      [['feat(skill)!: drop a route'], '', '0.2.0', '0.3.0'],
      [['fix: y'], 'BREAKING CHANGE: renamed', '0.9.3', '0.10.0'],
      [['feat(skill)!: drop a route'], '', '1.4.2', '2.0.0'],
      [['feat: z'], '', '1.4.2', '1.5.0'],
      [['chore: no prefix match'], '', '1.4.2', '1.4.3'],
    ];
    for (const [subjects, body, current, next] of cases) {
      const commits = subjects.map((subject) => commit(subject, body));
      expect(nextVersion(current, bumpLevel(commits)), subjects.join(', ')).toBe(next);
    }
    expect(() => nextVersion('1.0.0-next.1', 'patch')).toThrow(/non-stable/);
    expect(compareVersions('0.10.0', '0.9.9')).toBe(1);
    expect(compareVersions('1.0.0-next.2', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0-next.10', '1.0.0-next.2')).toBe(1);
    // npm package tags (v*) and pre-releases never become the bump base.
    expect(
      lastSkillTag(['v0.3.0', 'skill-v0.9.0', 'skill-v0.10.0', 'skill-v1.0.0-next.1', ''])
    ).toBe('skill-v0.10.0');
    expect(lastSkillTag(['v0.3.0'])).toBe('');
  });

  it('plans from the commits that touch skills/texuli since the last skill-v tag', () => {
    const repo = tempDir();
    const run = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
    run('init', '-q');
    run('config', 'user.email', 'dev@example.com');
    run('config', 'user.name', 'Dev');
    run('config', 'commit.gpgsign', 'false');
    run('config', 'tag.gpgsign', 'false');
    const pack = join(repo, 'skills', 'texuli');
    mkdirSync(pack, { recursive: true });
    const write = (rel: string, text: string, message: string) => {
      mkdirSync(join(repo, rel, '..'), { recursive: true });
      writeFileSync(join(repo, rel), text);
      run('add', '-A');
      run('commit', '-q', '-m', message);
    };
    write('skills/texuli/SKILL.md', '---\nversion: "0.2.0"\n---\n', 'feat(skill): first');
    // No tag yet: the router version is released as written.
    expect(releasePlan(repo)).toMatchObject({
      skip: false,
      bump: 'none',
      version: '0.2.0',
      tag: 'skill-v0.2.0',
      lastTag: '',
    });
    run('tag', 'skill-v0.2.0');
    run('tag', 'v9.9.9');
    write('packages/x.ts', 'export {};\n', 'feat(core): not the skill');
    expect(releasePlan(repo)).toMatchObject({ skip: true, bump: 'none' });
    write('skills/texuli/a.md', 'a\n', 'fix(skill): a');
    write('skills/texuli/b.md', 'b\n', 'chore(release): texuli skill 0.2.1 [skip release]');
    const patch = releasePlan(repo);
    expect(patch).toMatchObject({ skip: false, bump: 'patch', version: '0.2.1' });
    expect(patch.commits.map((c) => c.subject)).toEqual(['fix(skill): a']);
    write('skills/texuli/c.md', 'c\n', 'feat(skill): c');
    expect(releasePlan(repo)).toMatchObject({ bump: 'minor', version: '0.3.0' });
    // A deliberate version set by hand is released as written.
    write('skills/texuli/SKILL.md', '---\nversion: "1.0.0"\n---\n', 'feat(skill)!: stable');
    expect(releasePlan(repo)).toMatchObject({ bump: 'none', version: '1.0.0' });
    write('skills/texuli/SKILL.md', '---\nversion: "0.1.0"\n---\n', 'fix(skill): behind');
    expect(() => releasePlan(repo)).toThrow(/behind skill-v0.2.0/);
  });
});

describe('release stamp', () => {
  const header = '# Changelog\n\nIntro.\n\n';

  it('folds the [Unreleased] block under the commits and leaves an empty one on top', () => {
    const before = `${header}## [Unreleased]\n\n### Learnings\n\n- kept\n\n## [0.2.0] — 2026-10-01\n\n### Changes\n\n- old\n`;
    const { changelog, notes } = stampChangelog(before, '0.3.0', '2026-10-27', [
      commit('feat(skill): new route'),
      commit('fix(skill): link'),
    ]);
    expect(changelog).toBe(
      `${header}## [Unreleased]\n\n## [0.3.0] — 2026-10-27\n\n### Changes\n\n- feat(skill): new route\n- fix(skill): link\n\n### Learnings\n\n- kept\n\n## [0.2.0] — 2026-10-01\n\n### Changes\n\n- old\n`
    );
    expect(notes).toBe(
      '## [0.3.0] — 2026-10-27\n\n### Changes\n\n- feat(skill): new route\n- fix(skill): link\n\n### Learnings\n\n- kept\n'
    );
    expect(changelogVersions(changelog)).toEqual(['0.3.0', '0.2.0']);
    // An empty block adds nothing; a version cannot be stamped twice.
    const empty = stampChangelog(`${header}## [Unreleased]\n`, '0.1.0', '2026-10-27', [
      commit('fix: a'),
    ]);
    expect(empty.notes).toBe('## [0.1.0] — 2026-10-27\n\n### Changes\n\n- fix: a\n');
    expect(() => stampChangelog(changelog, '0.3.0', '2026-10-28', [])).toThrow(/already/);
    expect(() => stampChangelog(header, '0.3.0', '2026-10-28', [])).toThrow(/Unreleased/);
  });

  it('syncs the version into every SKILL.md, stamps, writes the sums, and the pack still verifies', () => {
    const repo = tempDir();
    const pack = join(repo, 'skills', 'texuli');
    mkdirSync(join(pack, 'themes'), { recursive: true });
    writeFileSync(join(pack, 'SKILL.md'), '---\nname: texuli\nversion: "0.2.0"\n---\n');
    writeFileSync(join(pack, 'themes', 'SKILL.md'), '---\nversion: "0.1.9"\n---\n');
    writeFileSync(join(pack, 'CHANGELOG.md'), `${header}## [Unreleased]\n\n- note\n`);
    expect(setPackVersion(pack, '0.2.0')).toEqual(['themes/SKILL.md']);
    const { notes } = applyRelease(
      repo,
      { version: '0.3.0', commits: [commit('feat(skill): x')] },
      '2026-10-27'
    );
    expect(notes).toContain('## [0.3.0] — 2026-10-27');
    expect(notes).toContain('- note');
    for (const rel of ['SKILL.md', 'themes/SKILL.md']) {
      expect(skillVersion(readFileSync(join(pack, rel), 'utf8')), rel).toBe('0.3.0');
    }
    expect(verifySkillChecksums(pack)).toEqual([]);
    expect(checkChangelog(pack)).toEqual([]);
    expect(() => setPackVersion(pack, 'latest')).toThrow(/SemVer/);
  });

  it('keeps the repository changelog Keep-a-Changelog and the router at or ahead of it', () => {
    expect(checkChangelog(skillRoot)).toEqual([]);
    const changelog = readFileSync(join(skillRoot, 'CHANGELOG.md'), 'utf8');
    // The page's release status reads the same file the release stamps.
    expect(latestRelease(changelog)).toBe(changelogVersions(changelog)[0] ?? '');
  });
});

describe('release archive and SHA256SUMS', () => {
  it('builds texuli-skill-<v>.tar.gz (pack only) and sums that verify with shasum and setup.sh', () => {
    const version = skillVersion(readFileSync(join(skillRoot, 'SKILL.md'), 'utf8'));
    const out = tempDir();
    const archive = `texuli-skill-${version}.tar.gz`;
    // The workflow uses `git archive --prefix=texuli/ <tag>:skills/texuli`;
    // tar over the working tree builds the same layout without a tag.
    execFileSync('tar', ['-czf', join(out, archive), '-C', join(root, 'skills'), 'texuli'], {
      env: { ...process.env, COPYFILE_DISABLE: '1' },
    });
    execFileSync('tar', ['-xzf', archive], { cwd: out });
    const files: string[] = [];
    const visit = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) visit(path);
        else if (!entry.name.endsWith('.DS_Store')) files.push(relative(out, path));
      }
    };
    visit(join(out, 'texuli'));
    const sum = (rel: string) =>
      `${createHash('sha256')
        .update(readFileSync(join(out, rel)))
        .digest('hex')}  ${rel}`;
    writeFileSync(join(out, 'SHA256SUMS'), `${[archive, ...files.sort()].map(sum).join('\n')}\n`);
    const listed = readFileSync(join(out, 'SHA256SUMS'), 'utf8').trim().split('\n');
    expect(listed[0]).toMatch(new RegExp(`  ${archive.replace(/\./g, '\\.')}$`));
    expect(listed.slice(1).every((line) => / {2}texuli\//.test(line))).toBe(true);
    const shasum = spawnSync('shasum', ['-a', '256', '-c', 'SHA256SUMS'], {
      cwd: out,
      encoding: 'utf8',
    });
    expect(shasum.status, shasum.stdout + shasum.stderr).toBe(0);
    const verify = spawnSync(
      'bash',
      ['texuli/setup.sh', '--verify', '--dir', 'texuli', '--expect-version', version],
      { cwd: out, encoding: 'utf8' }
    );
    expect(verify.status, verify.stderr).toBe(0);
    expect(verify.stdout).toContain('Verified.');
    // A tampered file fails the release sums.
    writeFileSync(join(out, 'texuli', 'TRUST.md'), 'changed\n');
    expect(spawnSync('shasum', ['-a', '256', '-c', 'SHA256SUMS'], { cwd: out }).status).not.toBe(0);
  }, 30000);
});

describe('workflows', () => {
  const read = (name: string) => readFileSync(join(root, '.github', 'workflows', name), 'utf8');
  const release = read('skill-release.yml');

  it('never lets a skill tag start the npm publish', () => {
    const publish = read('publish.yml');
    const filters = /tags:\s*\[([^\]]*)\]/.exec(publish)?.[1]?.split(',') ?? [];
    expect(filters.map((f) => f.trim().replace(/['"]/g, ''))).toEqual(['v*']);
    // GitHub matches a tag filter against the whole tag name; `*` stops at `/`.
    const glob = (pattern: string) =>
      new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
    expect(glob('v*').test('v0.3.0')).toBe(true);
    expect(glob('v*').test(`${SKILL_TAG_PREFIX}0.3.0`)).toBe(false);
    // The skill release has no tag trigger at all.
    expect(release).not.toMatch(/^\s+tags:/m);
  });

  it('runs after CI on main with least privilege and the documented steps in order', () => {
    expect(release).toMatch(
      /on:\n {2}workflow_run:\n {4}workflows: \[CI\]\n {4}types: \[completed\]\n {4}branches: \[main\]/
    );
    expect(release).toMatch(/^permissions: \{\}$/m);
    // The checkout persists no credentials; only the push step holds the token.
    expect(release).toContain('persist-credentials: false');
    expect(release.match(/PUSH_TOKEN: /g)).toHaveLength(1);
    for (const guard of [
      "github.event.workflow_run.conclusion == 'success'",
      "github.event.workflow_run.event == 'push'",
      "!startsWith(github.event.workflow_run.head_commit.message, 'chore(release):')",
      "!contains(github.event.workflow_run.head_commit.message, '[skip release]')",
    ]) {
      expect(release, guard).toContain(guard);
    }
    // Exactly one job may write; the third-party installer runs read-only.
    expect(release.match(/^\s+contents: write$/gm)).toHaveLength(1);
    const smoke = release.slice(release.indexOf('\n  smoke:'));
    expect(smoke).toContain('contents: read');
    expect(smoke).not.toContain('contents: write');
    // Commit messages and versions reach shell through env, never ${{ }} in run.
    for (const block of release.matchAll(/run: \|\n((?: {10}.*\n|\n)+)/g)) {
      expect(block[1]).not.toMatch(/\$\{\{/);
    }
    const steps = [
      'node scripts/check-skill.ts --release-plan',
      'node scripts/check-skill.ts --release "$VERSION"',
      'node scripts/check-skill.ts --write-sums',
      'git tag -a "$TAG"',
      `git archive --format=tar.gz --prefix=texuli/ -o "$OUT/$ARCHIVE" "\${TAG}:skills/texuli"`,
      'sha256sum -c SHA256SUMS',
      'bash texuli/setup.sh --verify --dir texuli --expect-version "$VERSION"',
      'git push --atomic \\\n            "https://x-access-token:${PUSH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"',
      'gh release create "$TAG"',
      `npx --yes skills@1.7.4 add "https://github.com/DailybotHQ/texuli/tree/\${TAG}/skills/texuli"`,
    ];
    const positions = steps.map((step) => release.indexOf(step));
    expect(
      positions.every((position) => position >= 0),
      steps.join('\n')
    ).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(release).toContain(`ARCHIVE="texuli-skill-\${VERSION}.tar.gz"`);
    expect(release).toContain('--notes-file "$RUNNER_TEMP/RELEASE_NOTES.md"');
    expect(release).toContain('[skip release]');
  });

  it('lints setup.sh and smoke-tests it under macOS bash 3.2 in CI', () => {
    const ci = read('ci.yml');
    expect(ci).toContain('- run: shellcheck skills/texuli/setup.sh');
    const job = ci.slice(ci.indexOf('\n  setup-smoke-macos:'));
    expect(job).toContain('runs-on: macos-latest');
    expect(job).toContain("grep 'version 3\\.2'");
    for (const flag of ['--help', '--version', '--verify', '--list-hosts', '--dry-run']) {
      expect(job, flag).toContain(flag);
    }
  });
});

describe('install commands (docs and /skill/)', () => {
  it('shows the same real, pinned commands in docs/SKILL_INSTALLATION.md and on the page', () => {
    const doc = readFileSync(join(root, 'docs', 'SKILL_INSTALLATION.md'), 'utf8');
    const fenced = [...doc.matchAll(/```bash\n([\s\S]*?)```/g)].flatMap((m) =>
      (m[1] as string).split('\n')
    );
    const routes = installRoutes('<version>');
    expect(routes.map((route) => route.id)).toEqual([
      'skills-cli',
      'openclaw',
      'checkout',
      'update',
      'uninstall',
    ]);
    const ctx = commandContext(root);
    for (const route of routes) {
      for (const command of route.commands) {
        expect(fenced, `${route.id}: ${command}`).toContain(command);
        if (command.startsWith('npx ')) {
          expect(isPinnedNetworkCommand(command), command).toBe(true);
          expect(checkCommand(command, ctx), command).toEqual([]);
        }
      }
    }
    // Every skills CLI install is pinned by tree URL, never by `@ref`.
    expect(doc).not.toMatch(/```bash\n[^`]*npx skills add DailybotHQ\/texuli@/);
    expect(installRoutes('0.3.0')[0]?.commands[0]).toBe(
      'npx skills add https://github.com/DailybotHQ/texuli/tree/skill-v0.3.0/skills/texuli --skill texuli'
    );
  });
});
