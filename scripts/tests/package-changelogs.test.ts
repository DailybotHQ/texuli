// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findMarkdownLinks } from '../check-skill.ts';
import {
  CHANGELOG_BLOB,
  changelogBanner,
  changelogDrift,
  changelogForPackage,
  compareVersions,
  mentionsPackage,
  packageChangelogs,
  parseReleaseNotes,
  rewriteChangelogHref,
  writePackageChangelogs,
} from '../package-changelogs.ts';
import { NEVER_PACKED, PUBLISHED_FILES, publishManifest, readWorkspace } from '../packages.ts';

const FIXTURE = `# Release

Release line: published \`0.17\`

### Not on npm

- \`@texuli/examples\`

### Package changelogs

Generated files.

### 0.17.1

A patch: every published package moves to \`0.17.1\` together, and every
internal \`@texuli/*\` pin is exactly \`0.17.1\`. The package code changes are in
\`@texuli/tools\` (\`@texuli/tools/ds-check\`), \`@texuli/catalog/manifest\`
and the \`texuli\` button styles.

**The lock, restored (\`@texuli/tools/ds-check\`).** Two \`0.17.0\` changes
weakened the locked render check; \`0.17.1\` restores it
([ds-check](../packages/tools/docs/ds-check.md)).

- A catalog root nested inside an allowed root is \`not-allowed\` again.

**Icon buttons (\`texuli/button\`).** Icon buttons keep the 24px target
([DESIGN_SYSTEMS](DESIGN_SYSTEMS.md#locked-design-systems),
[CI](CI.md#publishing-to-npm), [site](https://texuli.com/mcp), [here](#icon-buttons)).

### 0.9.0

Every published package moves to \`0.9.0\` together.
\`@texuli/mcp\` is published for the first time.

**\`@texuli/mcp\` (new on npm, L9).**

- The bin \`texuli-mcp\`.

### 0.8.x patch releases (G86)

Backwards-compatible fixes with no new public API:

| Package | Version | Why |
| --- | --- | --- |
| \`@texuli/data\` | \`0.8.1\` | The fix: list motion loads lazily |
| \`@texuli/tools\` | \`0.8.1\` | Pins \`@texuli/data\` \`0.8.1\` |
| \`@texuli/slides\` | \`0.8.2\` | Pins \`@texuli/blocks\` \`0.8.1\` |

**The fix (\`@texuli/data\`).** The Board took list motion statically.

### @texuli/slides 0.8.1

A backwards-compatible fix; no other package changes version.

### 0.8.0

Every published package moves to \`0.8.0\` together.

### History

- \`0.2.0\` first line
`;

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('mentionsPackage', () => {
  it('matches a scoped package and its subpath, not a longer name', () => {
    expect(mentionsPackage('see @texuli/tools/ds-check', '@texuli/tools')).toBe(true);
    expect(mentionsPackage('see @texuli/tools', '@texuli/data')).toBe(false);
    expect(mentionsPackage('see @texuli/corex', '@texuli/core')).toBe(false);
  });

  it('matches the texuli package without matching @texuli/tools or texuli.com', () => {
    expect(mentionsPackage('the `texuli` button', 'texuli')).toBe(true);
    expect(mentionsPackage('Icon buttons (`texuli/button`).', 'texuli')).toBe(true);
    expect(mentionsPackage('the lock in @texuli/tools/ds-check', 'texuli')).toBe(false);
    expect(mentionsPackage('deploys texuli.com from main', 'texuli')).toBe(false);
  });
});

describe('rewriteChangelogHref', () => {
  it('rewrites relative docs/ and package links to GitHub blob URLs', () => {
    expect(rewriteChangelogHref('../packages/tools/docs/ds-check.md')).toBe(
      `${CHANGELOG_BLOB}/packages/tools/docs/ds-check.md`
    );
    expect(rewriteChangelogHref('CI.md#publishing-to-npm')).toBe(
      `${CHANGELOG_BLOB}/docs/CI.md#publishing-to-npm`
    );
    expect(rewriteChangelogHref('DESIGN_SYSTEMS.md')).toBe(
      `${CHANGELOG_BLOB}/docs/DESIGN_SYSTEMS.md`
    );
  });

  it('keeps absolute URLs and in-page anchors', () => {
    expect(rewriteChangelogHref('https://texuli.com/mcp')).toBe('https://texuli.com/mcp');
    expect(rewriteChangelogHref('#icon-buttons')).toBe('#icon-buttons');
  });
});

describe('parseReleaseNotes', () => {
  it('reads version headings, package headings and the 0.8.x table, and skips History', () => {
    const sections = parseReleaseNotes(FIXTURE);
    expect(sections.map((section) => section.heading)).toEqual([
      '0.17.1',
      '0.9.0',
      '0.8.x patch releases (G86)',
      '@texuli/slides 0.8.1',
      '0.8.0',
    ]);
    expect(sections[0]?.version).toBe('0.17.1');
    expect(sections[2]?.version).toBeNull();
    expect(sections[3]?.packageName).toBe('@texuli/slides');
  });
});

describe('changelogForPackage', () => {
  it('gives tools the lock paragraphs and date the line-wide intro', () => {
    const tools = changelogForPackage('@texuli/tools', FIXTURE);
    expect(tools.startsWith(changelogBanner())).toBe(true);
    expect(tools).toContain('## 0.17.1');
    expect(tools).toContain('The lock, restored');
    expect(tools).toContain('every published package moves to `0.17.1`');
    expect(tools).toContain(`${CHANGELOG_BLOB}/packages/tools/docs/ds-check.md`);
    expect(tools).not.toContain('](../packages/');
    expect(tools).not.toContain('Icon buttons');
    expect(tools).toContain('## 0.8.1');
    expect(tools).toContain('| `@texuli/tools` | `0.8.1` |');
    expect(tools).not.toContain('| `@texuli/data` |');
    expect(tools).not.toContain('The Board took list motion');

    const date = changelogForPackage('@texuli/date', FIXTURE);
    expect(date).toContain('## 0.17.1');
    expect(date).toContain('every published package moves to `0.17.1`');
    expect(date).not.toContain('The lock, restored');
    expect(date).not.toContain('Icon buttons');

    const texuli = changelogForPackage('texuli', FIXTURE);
    expect(texuli).toContain(`${CHANGELOG_BLOB}/docs/DESIGN_SYSTEMS.md#locked-design-systems`);
    expect(texuli).toContain(`${CHANGELOG_BLOB}/docs/CI.md#publishing-to-npm`);
    expect(texuli).toContain('https://texuli.com/mcp');
    expect(texuli).toContain('](#icon-buttons)');
  });

  it('keeps mcp off versions before it shipped', () => {
    const mcp = changelogForPackage('@texuli/mcp', FIXTURE);
    expect(mcp).toContain('## 0.17.1');
    expect(mcp).toContain('## 0.9.0');
    expect(mcp).toContain('published for the first time');
    expect(mcp).not.toContain('## 0.8.0');
  });

  it('keeps the slides 0.8.1 heading and the 0.8.2 table row', () => {
    const slides = changelogForPackage('@texuli/slides', FIXTURE);
    expect(slides).toContain('## 0.8.2');
    expect(slides).toContain('| `@texuli/slides` | `0.8.2` |');
    expect(slides).toContain('## 0.8.1');
    expect(slides).toContain('A backwards-compatible fix; no other package changes version.');
  });

  it('sorts versions newest first', () => {
    expect(compareVersions('0.17.1', '0.9.0')).toBeGreaterThan(0);
    const tools = changelogForPackage('@texuli/tools', FIXTURE);
    const versions = [...tools.matchAll(/^## (\d+\.\d+\.\d+)$/gm)].map((match) => match[1]);
    expect(versions).toEqual([...versions].sort((a, b) => compareVersions(b ?? '', a ?? '')));
  });
});

describe('the 26 published packages', () => {
  const root = join(import.meta.dirname, '..', '..');
  const packable = readWorkspace(root).filter((pkg) => !NEVER_PACKED.includes(pkg.name));

  it('each ships a CHANGELOG.md that matches docs/RELEASE.md', () => {
    expect(packable).toHaveLength(26);
    expect([...PUBLISHED_FILES]).toEqual(['dist', 'CHANGELOG.md']);
    const files = packageChangelogs(root);
    expect(files).toHaveLength(26);
    const drift = changelogDrift(root);
    expect(drift).toEqual([]);
    for (const pkg of files) {
      expect(pkg.text.startsWith('# Changelog\n')).toBe(true);
      expect(pkg.text).toContain('Do not edit this file.');
      expect(pkg.text).toContain('## ');
    }
  });

  it('a generated changelog has no relative link', () => {
    const relative: string[] = [];
    for (const pkg of packageChangelogs(root)) {
      for (const { destination } of findMarkdownLinks(pkg.text)) {
        if (/^[a-z][a-z\d+.-]*:/i.test(destination)) continue;
        if (
          destination.startsWith('#') ||
          destination.startsWith('//') ||
          destination.startsWith('/')
        )
          continue;
        relative.push(`${pkg.path}: ${destination}`);
      }
    }
    expect(relative).toEqual([]);
  });

  it('lists CHANGELOG.md in the packed files', () => {
    const { manifest } = publishManifest(packable[0]!, new Map([[packable[0]!.name, '0.17.1']]));
    expect(manifest.files).toEqual(['dist', 'CHANGELOG.md']);
  });
});

describe('write and check', () => {
  it('writes matching files and reports drift', () => {
    const root = mkdtempSync(join(tmpdir(), 'texuli-changelogs-'));
    scratch.push(root);
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'docs', 'RELEASE.md'), FIXTURE);
    mkdirSync(join(root, 'packages', 'tools'), { recursive: true });
    writeFileSync(
      join(root, 'packages', 'tools', 'package.json'),
      JSON.stringify({ name: '@texuli/tools', version: '0.17.1' })
    );
    mkdirSync(join(root, 'packages', 'examples'), { recursive: true });
    writeFileSync(
      join(root, 'packages', 'examples', 'package.json'),
      JSON.stringify({ name: '@texuli/examples', version: '0.0.0' })
    );
    expect(changelogDrift(root)[0]).toMatch(/missing/);
    writePackageChangelogs(root);
    expect(changelogDrift(root)).toEqual([]);
    expect(readFileSync(join(root, 'packages', 'tools', 'CHANGELOG.md'), 'utf8')).toContain(
      'The lock, restored'
    );
    expect(packageChangelogs(root).map((pkg) => pkg.name)).toEqual(['@texuli/tools']);
    writeFileSync(join(root, 'packages', 'tools', 'CHANGELOG.md'), '# Changelog\nstale\n');
    expect(changelogDrift(root)[0]).toMatch(/differs from docs\/RELEASE.md/);
  });
});
