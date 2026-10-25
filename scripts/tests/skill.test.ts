import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkCliReferences,
  checkCommand,
  checkRequiredFiles,
  checkSkillPack,
  checkSnippetImports,
  cliCommands,
  codeBlocks,
  commandContext,
  expectedSkillName,
  findMarkdownLinks,
  parseFrontmatter,
  repositoryRootFromHere,
  sha256File,
  validateFrontmatterParsed,
  validateSkillCommands,
  validateSkillFile,
  validateSkillLinks,
  verifySkillChecksums,
  writeSkillChecksums,
} from '../check-skill.ts';
// The components sub-skill runs every command and snippet it documents.
import './skill-components.suite.ts';
// The evals sub-skill scores skill-following trees with the golden scorer.
import './skill-evals.suite.ts';

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
  const dir = mkdtempSync(join(tmpdir(), 'texuli-skill-'));
  scratch.push(dir);
  return dir;
}

describe('skill frontmatter parser', () => {
  it('parses quoted SemVer and nested openclaw metadata', () => {
    const source = `---
name: texuli
description: Router skill.
version: "0.1.0"
documentation_url: https://texuli.com/docs/
user-invocable: true
allowed-tools: Bash, Read
metadata:
  openclaw:
    emoji: "▣"
    homepage: https://texuli.com/docs/
    requires:
      anyBins:
        - bash
        - git
---

# Body
`;
    const parsed = parseFrontmatter(source);
    expect(parsed.values.name).toBe('texuli');
    expect(parsed.values.version).toBe('0.1.0');
    expect(parsed.values['user-invocable']).toBe(true);
    const issues = validateFrontmatterParsed('SKILL.md', parsed, 'texuli');
    expect(issues).toEqual([]);
  });

  it('rejects unquoted version and wrong documentation_url', () => {
    const source = `---
name: texuli
description: x
version: 0.1.0
documentation_url: https://example.com/
user-invocable: true
allowed-tools: Bash
metadata:
  openclaw:
    emoji: x
    homepage: https://example.com/
    requires:
      anyBins:
        - bash
---
`;
    const parsed = parseFrontmatter(source);
    const issues = validateFrontmatterParsed('SKILL.md', parsed, 'texuli');
    expect(issues.some((i) => i.field === 'version')).toBe(true);
    expect(issues.some((i) => i.field === 'documentation_url')).toBe(true);
  });

  it('maps nested skill folders to expected names', () => {
    expect(expectedSkillName(skillRoot, join(skillRoot, 'SKILL.md'))).toBe('texuli');
    expect(expectedSkillName(skillRoot, join(skillRoot, 'themes', 'SKILL.md'))).toBe(
      'texuli-themes'
    );
  });
});

describe('skill links', () => {
  it('finds markdown links outside code fences', () => {
    const md = `# Title
See [routes](routes.md) and \`[not](x.md)\`.

\`\`\`
[skip](nope.md)
\`\`\`
`;
    const links = findMarkdownLinks(md);
    expect(links.map((l) => l.destination)).toEqual(['routes.md']);
  });

  it('flags missing relative targets inside a temp pack', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'a.md'), '# A\n\n[missing](./missing.md)\n[ok](./b.md)\n', 'utf8');
    writeFileSync(join(dir, 'b.md'), '# B\n', 'utf8');
    const issues = validateSkillLinks(dir);
    expect(issues.some((i) => i.message.includes('missing.md'))).toBe(true);
    expect(issues.every((i) => !i.message.includes('b.md') || i.message.includes('missing'))).toBe(
      true
    );
  });
});

describe('checksums', () => {
  it('round-trips write and verify on a tiny pack', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'hello.txt'), 'hello\n', 'utf8');
    writeSkillChecksums(dir);
    expect(verifySkillChecksums(dir)).toEqual([]);
    writeFileSync(join(dir, 'hello.txt'), 'changed\n', 'utf8');
    expect(verifySkillChecksums(dir).some((i) => i.field === 'checksum')).toBe(true);
  });

  it('hashes files stably', () => {
    const dir = tempDir();
    const path = join(dir, 'x.bin');
    writeFileSync(path, Buffer.from([1, 2, 3]));
    expect(sha256File(path)).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256File(path)).toBe(sha256File(path));
  });
});

describe('skills/texuli pack (repository)', () => {
  it('has every required file', () => {
    expect(checkRequiredFiles(skillRoot)).toEqual([]);
  });

  it('router SKILL.md frontmatter is valid for hosts', () => {
    const issues = validateSkillFile(
      join(skillRoot, 'SKILL.md'),
      'skills/texuli/SKILL.md',
      'texuli'
    );
    expect(issues).toEqual([]);
  });

  it('contribute sub-skill frontmatter matches folder name', () => {
    const path = join(skillRoot, 'contribute', 'SKILL.md');
    expect(expectedSkillName(skillRoot, path)).toBe('texuli-contribute');
    const issues = validateSkillFile(
      path,
      'skills/texuli/contribute/SKILL.md',
      'texuli-contribute'
    );
    expect(issues).toEqual([]);
  });

  it('media sub-skill frontmatter matches folder name', () => {
    const path = join(skillRoot, 'media', 'SKILL.md');
    expect(expectedSkillName(skillRoot, path)).toBe('texuli-media');
    const issues = validateSkillFile(path, 'skills/texuli/media/SKILL.md', 'texuli-media');
    expect(issues).toEqual([]);
  });

  it('components sub-skill frontmatter matches folder name', () => {
    const path = join(skillRoot, 'components', 'SKILL.md');
    expect(expectedSkillName(skillRoot, path)).toBe('texuli-components');
    const issues = validateSkillFile(
      path,
      'skills/texuli/components/SKILL.md',
      'texuli-components'
    );
    expect(issues).toEqual([]);
  });

  it('components references resolve offline and are listed in SHA256SUMS', () => {
    expect(
      validateSkillLinks(skillRoot).filter((issue) => issue.file.startsWith('components/'))
    ).toEqual([]);
    writeSkillChecksums(skillRoot);
    const sums = readFileSync(join(skillRoot, 'SHA256SUMS'), 'utf8');
    for (const file of [
      'SKILL.md',
      'references/install.md',
      'references/customize.md',
      'references/update.md',
    ]) {
      expect(sums).toContain(`components/${file}`);
    }
  });

  it('themes sub-skill frontmatter matches folder name', () => {
    const path = join(skillRoot, 'themes', 'SKILL.md');
    expect(expectedSkillName(skillRoot, path)).toBe('texuli-themes');
    const issues = validateSkillFile(path, 'skills/texuli/themes/SKILL.md', 'texuli-themes');
    expect(issues).toEqual([]);
  });

  it('build-ui sub-skill frontmatter matches folder name', () => {
    const path = join(skillRoot, 'build-ui', 'SKILL.md');
    expect(expectedSkillName(skillRoot, path)).toBe('texuli-build-ui');
    const issues = validateSkillFile(path, 'skills/texuli/build-ui/SKILL.md', 'texuli-build-ui');
    expect(issues).toEqual([]);
  });

  it('evals sub-skill frontmatter, links and checksums', () => {
    const path = join(skillRoot, 'evals', 'SKILL.md');
    expect(expectedSkillName(skillRoot, path)).toBe('texuli-evals');
    expect(validateSkillFile(path, 'skills/texuli/evals/SKILL.md', 'texuli-evals')).toEqual([]);
    expect(
      validateSkillLinks(skillRoot).filter((issue) => issue.file.startsWith('evals/'))
    ).toEqual([]);
    writeSkillChecksums(skillRoot);
    const sums = readFileSync(join(skillRoot, 'SHA256SUMS'), 'utf8');
    for (const file of [
      'SKILL.md',
      'scenarios.json',
      'runs/skill-following.json',
      'runs/rule-breaks.json',
      'references/protocol.md',
    ]) {
      expect(sums).toContain(`evals/${file}`);
    }
  });

  it('contribute references resolve offline within the pack', () => {
    const issues = validateSkillLinks(skillRoot).filter((issue) =>
      issue.file.startsWith('contribute/')
    );
    expect(issues).toEqual([]);
  });

  it('media references resolve offline within the pack', () => {
    const issues = validateSkillLinks(skillRoot).filter((issue) => issue.file.startsWith('media/'));
    expect(issues).toEqual([]);
  });

  it('themes references resolve offline within the pack', () => {
    const issues = validateSkillLinks(skillRoot).filter((issue) =>
      issue.file.startsWith('themes/')
    );
    expect(issues).toEqual([]);
  });

  it('build-ui references resolve offline within the pack', () => {
    const issues = validateSkillLinks(skillRoot).filter((issue) =>
      issue.file.startsWith('build-ui/')
    );
    expect(issues).toEqual([]);
  });

  it('SHA256SUMS lists contribute files', () => {
    writeSkillChecksums(skillRoot);
    const sums = readFileSync(join(skillRoot, 'SHA256SUMS'), 'utf8');
    expect(sums).toContain('contribute/SKILL.md');
    expect(sums).toContain('contribute/references/gates.md');
  });

  it('SHA256SUMS lists media sub-skill files', () => {
    writeSkillChecksums(skillRoot);
    const sums = readFileSync(join(skillRoot, 'SHA256SUMS'), 'utf8');
    expect(sums).toContain('media/SKILL.md');
    expect(sums).toContain('media/references/gates.md');
    expect(sums).toContain('media/references/imports.md');
    expect(sums).toContain('media/references/url-policy.md');
  });

  it('SHA256SUMS lists themes sub-skill files', () => {
    writeSkillChecksums(skillRoot);
    const sums = readFileSync(join(skillRoot, 'SHA256SUMS'), 'utf8');
    expect(sums).toContain('themes/SKILL.md');
    expect(sums).toContain('themes/references/commands.md');
    expect(sums).toContain('themes/references/modes.md');
    expect(sums).toContain('themes/references/aa.md');
  });

  it('SHA256SUMS lists build-ui sub-skill files', () => {
    writeSkillChecksums(skillRoot);
    const sums = readFileSync(join(skillRoot, 'SHA256SUMS'), 'utf8');
    expect(sums).toContain('build-ui/SKILL.md');
    expect(sums).toContain('build-ui/references/loop.md');
    expect(sums).toContain('build-ui/references/recipes.md');
    expect(sums).toContain('build-ui/references/gates.md');
    expect(sums).toContain('build-ui/references/imports.md');
  });

  it('relative links inside the pack resolve', () => {
    expect(validateSkillLinks(skillRoot)).toEqual([]);
  });

  it('SHA256SUMS matches the pack (regenerate if this fails after intentional edits)', () => {
    // Keep sums in sync with the tree for the gate.
    writeSkillChecksums(skillRoot);
    expect(verifySkillChecksums(skillRoot)).toEqual([]);
    const sums = readFileSync(join(skillRoot, 'SHA256SUMS'), 'utf8');
    expect(sums).toContain('SKILL.md');
    expect(sums).toContain('setup.sh');
    expect(sums).toContain('router/routes.md');
  });

  it('checkSkillPack reports zero issues after sums are written', () => {
    const issues = checkSkillPack(root, { writeSums: true });
    expect(issues).toEqual([]);
  });

  it('setup.sh --list-hosts and --help run offline', async () => {
    const { execFileSync } = await import('node:child_process');
    const setup = join(skillRoot, 'setup.sh');
    const help = execFileSync('bash', [setup, '--help'], { encoding: 'utf8' });
    expect(help).toContain('--host');
    expect(help).toContain('--verify');
    const hosts = execFileSync('bash', [setup, '--list-hosts'], { encoding: 'utf8' });
    expect(hosts).toContain('claude');
    expect(hosts).toContain('skills/texuli');
  });

  it('setup.sh --verify succeeds against the pack checksums', async () => {
    const { execFileSync } = await import('node:child_process');
    writeSkillChecksums(skillRoot);
    const out = execFileSync('bash', [join(skillRoot, 'setup.sh'), '--verify'], {
      encoding: 'utf8',
    });
    expect(out).toContain('Verified');
    // Hashes every pack file with the system shasum: seconds under a loaded machine.
  }, 30_000);

  it('setup.sh --dry-run does not write under a temp home', async () => {
    const { execFileSync } = await import('node:child_process');
    const home = tempDir();
    mkdirSync(join(home, '.claude', 'skills'), { recursive: true });
    const out = execFileSync(
      'bash',
      [join(skillRoot, 'setup.sh'), '--host', 'claude', '--home', home, '--dry-run'],
      { encoding: 'utf8' }
    );
    expect(out).toMatch(/Dry run/i);
    // A dry run writes nothing: the host's skills folder stays empty.
    expect(readdirSync(join(home, '.claude', 'skills'))).toEqual([]);
  });
});

describe('commands, CLI references and snippets', () => {
  const ctx = commandContext(root);

  it('reads fenced code blocks with their language and line', () => {
    const blocks = codeBlocks(
      '# T\n\n```bash\npnpm check:skill\n```\n\ntext\n\n```json\n{}\n```\n'
    );
    expect(blocks.map((block) => [block.lang, block.line])).toEqual([
      ['bash', 3],
      ['json', 9],
    ]);
  });

  it('learns the CLI commands from the real usage text', () => {
    const commands = cliCommands(root);
    for (const command of [
      'add',
      'diff',
      'update',
      'init',
      'theme',
      'theme list',
      'theme preview',
      'theme apply',
    ]) {
      expect(commands.has(command), command).toBe(true);
    }
  });

  it('accepts real, offline commands', () => {
    for (const line of [
      'pnpm check:skill',
      'pnpm vitest run scripts/tests/skill.test.ts',
      'pnpm --filter texuli typecheck',
      'pnpm exec tsx scripts/check-skill.ts --write-sums',
      'TEXULI_E2E_PORT=4830 pnpm exec playwright test tests/e2e/site-seo.spec.ts',
      'pnpm vitest run packages/texuli/tests/<name>.test.ts',
      'npx biome check scripts/check-skill.ts',
      './skills/texuli/setup.sh --verify --expect-version 0.1.0',
      './texuli/setup.sh --verify --dir ./texuli --sums ./SHA256SUMS',
      'git merge --no-edit dev',
      'tar -xzf texuli-skill-0.1.0.tar.gz',
      'texuli theme preview <id>',
    ]) {
      expect(checkCommand(line, ctx), line).toEqual([]);
    }
  });

  it('rejects network, missing and made-up commands', () => {
    const cases: [string, RegExp][] = [
      ['curl -L https://example.com/x', /network/],
      ['pnpm dlx some-tool', /offline/],
      ['pnpm no-such-script', /no such root script/],
      ['pnpm --filter @texuli/nope build', /no such workspace package/],
      ['pnpm --filter texuli no-such-script', /no "no-such-script" script/],
      ['pnpm vitest run packages/nope/tests/missing.test.ts', /does not exist/],
      ['pnpm exec tsx scripts/missing.ts', /does not exist/],
      ['npx cowsay hi', /would download/],
      ['./skills/texuli/setup.sh --frobnicate', /no --frobnicate option/],
      ['git push origin main', /remote/],
      ['git remote add origin x', /remote/],
      ['texuli explode', /not a Texuli CLI command/],
      ['make everything', /unknown command/],
    ];
    for (const [line, message] of cases) {
      const problems = checkCommand(line, ctx);
      expect(problems.length, line).toBe(1);
      expect(problems[0], line).toMatch(message);
    }
  });

  it('checks `texuli …` references in prose, not inside code fences', () => {
    const markdown =
      'Run `texuli theme preview <id>` then `texuli explode`.\n\n```text\ntexuli whatever\n```\n';
    expect(checkCliReferences(markdown, ctx)).toEqual([
      { line: 1, message: '`texuli explode` is not a Texuli CLI command' },
    ]);
  });

  it('checks Texuli imports against real package exports', () => {
    const ok = `import { Rating } from 'texuli/rating';\nimport { createRovingFocus } from '@texuli/core/roving';\nimport { cx } from '../../internal/cx.ts';\nimport { mount } from 'svelte';`;
    expect(checkSnippetImports(ok, root)).toEqual([]);
    expect(checkSnippetImports("import { x } from '@texuli/core/nope';", root)).toEqual([
      '@texuli/core/nope: @texuli/core does not export "./nope"',
    ]);
    expect(checkSnippetImports("import { x } from '@texuli/missing';", root)).toEqual([
      '@texuli/missing: no workspace package @texuli/missing',
    ]);
  });

  it('reports bad snippets and commands in a pack with file and line', () => {
    const pack = tempDir();
    writeFileSync(
      join(pack, 'GUIDE.md'),
      '# Guide\n\n```json\n{ "broken": }\n```\n\n```bash\npnpm check:skill\ncurl https://example.com\n```\n'
    );
    const issues = validateSkillCommands(pack, root);
    expect(issues.map((item) => `${item.file} ${item.field}`)).toEqual([
      'GUIDE.md snippet:3',
      'GUIDE.md command:9',
    ]);
  });

  it('the repository pack has no command, CLI or snippet issues', () => {
    expect(validateSkillCommands(skillRoot, root)).toEqual([]);
  });
});

describe('setup.sh pinning', () => {
  const setup = join(skillRoot, 'setup.sh');
  const version =
    (parseFrontmatter(readFileSync(join(skillRoot, 'SKILL.md'), 'utf8')).values
      .version as string) ?? '';

  async function run(args: string[]): Promise<{ code: number; out: string }> {
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync('bash', [setup, ...args], { encoding: 'utf8' });
    return { code: result.status ?? -1, out: `${result.stdout}${result.stderr}` };
  }

  it('--version prints the pack version', async () => {
    const { code, out } = await run(['--version']);
    expect(code).toBe(0);
    expect(out.trim()).toBe(version);
  });

  it('--verify passes with the matching pin and refuses another version', async () => {
    writeSkillChecksums(skillRoot);
    const ok = await run(['--verify', '--expect-version', version]);
    expect(ok.code, ok.out).toBe(0);
    expect(ok.out).toContain(`pinned version: ${version} (matches)`);
    const wrong = await run(['--verify', '--expect-version', '9.9.9']);
    expect(wrong.code).toBe(1);
    expect(wrong.out).toContain(`pinned to version 9.9.9, but`);
    // Hashes every pack file with the system shasum: seconds under a loaded machine.
  }, 30_000);

  it('a mismatched pin writes nothing; a matching pin installs', async () => {
    const home = tempDir();
    const refused = await run(['--host', 'claude', '--home', home, '--expect-version', '9.9.9']);
    expect(refused.code).toBe(1);
    expect(readdirSync(home)).toEqual([]);
    const installed = await run(['--host', 'claude', '--home', home, '--expect-version', version]);
    expect(installed.code, installed.out).toBe(0);
    expect(readFileSync(join(home, '.claude', 'skills', 'texuli', 'SKILL.md'), 'utf8')).toContain(
      `version: "${version}"`
    );
  });

  it('--expect-version needs a value', async () => {
    const { code, out } = await run(['--verify', '--expect-version']);
    expect(code).toBe(2);
    expect(out).toContain('--expect-version needs a version');
  });
});
