import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BUNDLE_BUDGET,
  checkBudgets,
  checkCliReferences,
  checkCommand,
  checkMirror,
  checkOperationReferences,
  checkRequiredFiles,
  checkSkillPack,
  checkSnippetImports,
  checkVersionSync,
  cliCommands,
  codeBlocks,
  commandContext,
  DESCRIPTION_MAX,
  expectedSkillName,
  findMarkdownLinks,
  isPinnedNetworkCommand,
  mirrorDifferences,
  NAME_MAX,
  parseFrontmatter,
  repositoryRootFromHere,
  SKILL_MD_BUDGET,
  sha256File,
  skillBundles,
  skillFolderHash,
  skillMdPaths,
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
  it('parses quoted SemVer and single-line JSON openclaw metadata; rejects unquoted version and wrong documentation_url; requires the built /guides/ route as documentation_url and homepage (T-100 P1-4); maps nested skill folders to expected names', () => {
    // parses quoted SemVer and single-line JSON openclaw metadata
    {
      const source = `---
name: texuli
description: Router skill.
version: "0.1.0"
documentation_url: https://texuli.com/guides/
user-invocable: true
allowed-tools: Bash, Read
metadata: {"openclaw":{"emoji":"▣","homepage":"https://texuli.com/guides/","requires":{"anyBins":["bash","git"]}}}
---

# Body
`;
      const parsed = parseFrontmatter(source);
      expect(parsed.values.name).toBe('texuli');
      expect(parsed.values.version).toBe('0.1.0');
      expect(parsed.values['user-invocable']).toBe(true);
      const issues = validateFrontmatterParsed('SKILL.md', parsed, 'texuli');
      expect(issues).toEqual([]);
    }
    // rejects unquoted version and wrong documentation_url
    {
      const source = `---
name: texuli
description: x
version: 0.1.0
documentation_url: https://example.com/
user-invocable: true
allowed-tools: Bash
metadata: {"openclaw":{"emoji":"x","homepage":"https://example.com/","requires":{"anyBins":["bash"]}}}
---
`;
      const parsed = parseFrontmatter(source);
      const issues = validateFrontmatterParsed('SKILL.md', parsed, 'texuli');
      expect(issues.some((i) => i.field === 'version')).toBe(true);
      expect(issues.some((i) => i.field === 'documentation_url')).toBe(true);
    }
    // requires the built /guides/ route as documentation_url and homepage (T-100 P1-4)
    {
      const frontmatter = (url: string) => `---
name: texuli
description: x
version: "0.1.0"
documentation_url: ${url}
user-invocable: true
allowed-tools: Bash
metadata: {"openclaw":{"emoji":"x","homepage":"${url}","requires":{"anyBins":["bash"]}}}
---
`;
      const fields = (url: string) =>
        validateFrontmatterParsed('SKILL.md', parseFrontmatter(frontmatter(url)), 'texuli').map(
          (i) => i.field
        );
      expect(fields('https://texuli.com/guides/')).toEqual([]);
      // texuli.com has no /docs/ route.
      expect(fields('https://texuli.com/docs/')).toEqual(
        expect.arrayContaining(['documentation_url', 'metadata.openclaw.homepage'])
      );
    }
    expect(expectedSkillName(skillRoot, join(skillRoot, 'SKILL.md'))).toBe('texuli');
    expect(expectedSkillName(skillRoot, join(skillRoot, 'themes', 'SKILL.md'))).toBe(
      'texuli-themes'
    );
  });
});

describe('skill links', () => {
  it('finds markdown links outside code fences; flags missing relative targets inside a temp pack', () => {
    // finds markdown links outside code fences
    {
      const md = `# Title
See [routes](routes.md) and \`[not](x.md)\`.

\`\`\`
[skip](nope.md)
\`\`\`
`;
      const links = findMarkdownLinks(md);
      expect(links.map((l) => l.destination)).toEqual(['routes.md']);
    }
    // flags missing relative targets inside a temp pack
    {
      const dir = tempDir();
      writeFileSync(join(dir, 'a.md'), '# A\n\n[missing](./missing.md)\n[ok](./b.md)\n', 'utf8');
      writeFileSync(join(dir, 'b.md'), '# B\n', 'utf8');
      const issues = validateSkillLinks(dir);
      expect(issues.some((i) => i.message.includes('missing.md'))).toBe(true);
      expect(
        issues.every((i) => !i.message.includes('b.md') || i.message.includes('missing'))
      ).toBe(true);
    }
  });
});

describe('checksums', () => {
  it('round-trips write and verify on a tiny pack; hashes files stably', () => {
    // round-trips write and verify on a tiny pack
    {
      const dir = tempDir();
      writeFileSync(join(dir, 'hello.txt'), 'hello\n', 'utf8');
      writeSkillChecksums(dir);
      expect(verifySkillChecksums(dir)).toEqual([]);
      writeFileSync(join(dir, 'hello.txt'), 'changed\n', 'utf8');
      expect(verifySkillChecksums(dir).some((i) => i.field === 'checksum')).toBe(true);
    }
    // hashes files stably
    {
      const dir = tempDir();
      const path = join(dir, 'x.bin');
      writeFileSync(path, Buffer.from([1, 2, 3]));
      expect(sha256File(path)).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256File(path)).toBe(sha256File(path));
    }
  });
});

describe('skills/texuli pack (repository)', () => {
  it('has every required file; router SKILL.md frontmatter is valid for hosts; contribute sub-skill frontmatter matches folder name; media sub-skill frontmatter matches folder name; components sub-skill frontmatter matches folder name; components references resolve offline and are listed in SHA256SUMS; themes sub-skill frontmatter matches folder name; build-ui sub-skill frontmatter matches folder name; evals sub-skill frontmatter, links and checksums; contribute references resolve offline within the pack; media references resolve offline within the pack; themes references resolve offline within the pack; build-ui references resolve offline within the pack; SHA256SUMS lists contribute files; SHA256SUMS lists media sub-skill files; SHA256SUMS lists themes sub-skill files; SHA256SUMS lists build-ui sub-skill files; relative links inside the pack resolve; SHA256SUMS matches the pack (regenerate if this fails after intentional edits); checkSkillPack reports zero issues on the committed pack; setup.sh --list-hosts and --help run offline; setup.sh --verify succeeds against the pack checksums; setup.sh --dry-run does not write under a temp home', async () => {
    expect(checkRequiredFiles(skillRoot)).toEqual([]);
    // router SKILL.md frontmatter is valid for hosts
    {
      const issues = validateSkillFile(
        join(skillRoot, 'SKILL.md'),
        'skills/texuli/SKILL.md',
        'texuli'
      );
      expect(issues).toEqual([]);
    }
    // contribute sub-skill frontmatter matches folder name
    {
      const path = join(skillRoot, 'contribute', 'SKILL.md');
      expect(expectedSkillName(skillRoot, path)).toBe('texuli-contribute');
      const issues = validateSkillFile(
        path,
        'skills/texuli/contribute/SKILL.md',
        'texuli-contribute'
      );
      expect(issues).toEqual([]);
    }
    // media sub-skill frontmatter matches folder name
    {
      const path = join(skillRoot, 'media', 'SKILL.md');
      expect(expectedSkillName(skillRoot, path)).toBe('texuli-media');
      const issues = validateSkillFile(path, 'skills/texuli/media/SKILL.md', 'texuli-media');
      expect(issues).toEqual([]);
    }
    // components sub-skill frontmatter matches folder name
    {
      const path = join(skillRoot, 'components', 'SKILL.md');
      expect(expectedSkillName(skillRoot, path)).toBe('texuli-components');
      const issues = validateSkillFile(
        path,
        'skills/texuli/components/SKILL.md',
        'texuli-components'
      );
      expect(issues).toEqual([]);
    }
    // components references resolve offline and are listed in SHA256SUMS
    {
      expect(
        validateSkillLinks(skillRoot).filter((issue) => issue.file.startsWith('components/'))
      ).toEqual([]);
      const sums = readFileSync(join(skillRoot, 'SHA256SUMS'), 'utf8');
      for (const file of [
        'SKILL.md',
        'references/install.md',
        'references/customize.md',
        'references/update.md',
      ]) {
        expect(sums).toContain(`components/${file}`);
      }
    }
    // themes sub-skill frontmatter matches folder name
    {
      const path = join(skillRoot, 'themes', 'SKILL.md');
      expect(expectedSkillName(skillRoot, path)).toBe('texuli-themes');
      const issues = validateSkillFile(path, 'skills/texuli/themes/SKILL.md', 'texuli-themes');
      expect(issues).toEqual([]);
    }
    // build-ui sub-skill frontmatter matches folder name
    {
      const path = join(skillRoot, 'build-ui', 'SKILL.md');
      expect(expectedSkillName(skillRoot, path)).toBe('texuli-build-ui');
      const issues = validateSkillFile(path, 'skills/texuli/build-ui/SKILL.md', 'texuli-build-ui');
      expect(issues).toEqual([]);
    }
    // evals sub-skill frontmatter, links and checksums
    {
      const path = join(skillRoot, 'evals', 'SKILL.md');
      expect(expectedSkillName(skillRoot, path)).toBe('texuli-evals');
      expect(validateSkillFile(path, 'skills/texuli/evals/SKILL.md', 'texuli-evals')).toEqual([]);
      expect(
        validateSkillLinks(skillRoot).filter((issue) => issue.file.startsWith('evals/'))
      ).toEqual([]);
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
    }
    // contribute references resolve offline within the pack
    {
      const issues = validateSkillLinks(skillRoot).filter((issue) =>
        issue.file.startsWith('contribute/')
      );
      expect(issues).toEqual([]);
    }
    // media references resolve offline within the pack
    {
      const issues = validateSkillLinks(skillRoot).filter((issue) =>
        issue.file.startsWith('media/')
      );
      expect(issues).toEqual([]);
    }
    // themes references resolve offline within the pack
    {
      const issues = validateSkillLinks(skillRoot).filter((issue) =>
        issue.file.startsWith('themes/')
      );
      expect(issues).toEqual([]);
    }
    // build-ui references resolve offline within the pack
    {
      const issues = validateSkillLinks(skillRoot).filter((issue) =>
        issue.file.startsWith('build-ui/')
      );
      expect(issues).toEqual([]);
    }
    // SHA256SUMS lists contribute files
    {
      const sums = readFileSync(join(skillRoot, 'SHA256SUMS'), 'utf8');
      expect(sums).toContain('contribute/SKILL.md');
      expect(sums).toContain('contribute/references/gates.md');
    }
    // SHA256SUMS lists media sub-skill files
    {
      const sums = readFileSync(join(skillRoot, 'SHA256SUMS'), 'utf8');
      expect(sums).toContain('media/SKILL.md');
      expect(sums).toContain('media/references/gates.md');
      expect(sums).toContain('media/references/imports.md');
      expect(sums).toContain('media/references/url-policy.md');
    }
    // SHA256SUMS lists themes sub-skill files
    {
      const sums = readFileSync(join(skillRoot, 'SHA256SUMS'), 'utf8');
      expect(sums).toContain('themes/SKILL.md');
      expect(sums).toContain('themes/references/commands.md');
      expect(sums).toContain('themes/references/modes.md');
      expect(sums).toContain('themes/references/aa.md');
    }
    // SHA256SUMS lists build-ui sub-skill files
    {
      const sums = readFileSync(join(skillRoot, 'SHA256SUMS'), 'utf8');
      expect(sums).toContain('build-ui/SKILL.md');
      expect(sums).toContain('build-ui/references/loop.md');
      expect(sums).toContain('build-ui/references/recipes.md');
      expect(sums).toContain('build-ui/references/gates.md');
      expect(sums).toContain('build-ui/references/imports.md');
    }
    expect(validateSkillLinks(skillRoot)).toEqual([]);
    // SHA256SUMS matches the pack (regenerate if this fails after intentional edits)
    {
      // Verify only: a test that rewrote the sums first could never fail, and
      // it silently rewrote the committed file on every run (T-100 review).
      // Regenerate with `pnpm exec tsx scripts/check-skill.ts --write-sums`.
      expect(verifySkillChecksums(skillRoot)).toEqual([]);
      const sums = readFileSync(join(skillRoot, 'SHA256SUMS'), 'utf8');
      expect(sums).toContain('SKILL.md');
      expect(sums).toContain('setup.sh');
      expect(sums).toContain('router/routes.md');
    }
    // checkSkillPack reports zero issues on the committed pack
    {
      const issues = checkSkillPack(root);
      expect(issues).toEqual([]);
    }
    // setup.sh --list-hosts and --help run offline
    {
      const { execFileSync } = await import('node:child_process');
      const setup = join(skillRoot, 'setup.sh');
      const help = execFileSync('bash', [setup, '--help'], { encoding: 'utf8' });
      expect(help).toContain('--host');
      expect(help).toContain('--verify');
      const hosts = execFileSync('bash', [setup, '--list-hosts'], { encoding: 'utf8' });
      expect(hosts).toContain('claude');
      expect(hosts).toContain('skills/texuli');
    }
    // setup.sh --verify succeeds against the pack checksums
    {
      const { execFileSync } = await import('node:child_process');
      const out = execFileSync('bash', [join(skillRoot, 'setup.sh'), '--verify'], {
        encoding: 'utf8',
      });
      expect(out).toContain('Verified');
      // Hashes every pack file with the system shasum: seconds under a loaded machine.
    }
    // setup.sh --dry-run does not write under a temp home
    {
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
    }
  }, 30000);
});

describe('commands, CLI references and snippets', () => {
  const ctx = commandContext(root);

  it('reads fenced code blocks with their language and line; learns the CLI commands from the real usage text; accepts real, offline commands; rejects network, missing and made-up commands; checks `texuli …` references in prose, not inside code fences; checks Texuli imports against real package exports; reports bad snippets and commands in a pack with file and line; the repository pack has no command, CLI or snippet issues', () => {
    // reads fenced code blocks with their language and line
    {
      const blocks = codeBlocks(
        '# T\n\n```bash\npnpm check:skill\n```\n\ntext\n\n```json\n{}\n```\n'
      );
      expect(blocks.map((block) => [block.lang, block.line])).toEqual([
        ['bash', 3],
        ['json', 9],
      ]);
    }
    // learns the CLI commands from the real usage text
    {
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
    }
    for (const line of [
      'pnpm check:skill',
      'pnpm vitest run scripts/tests/skill.test.ts',
      'pnpm --filter texuli typecheck',
      'pnpm exec tsx scripts/check-skill.ts --write-sums',
      'TEXULI_E2E_PORT=4830 pnpm exec playwright test tests/e2e/site-seo.spec.ts',
      'pnpm vitest run packages/texuli/tests/<name>.test.ts',
      'npx biome check scripts/check-skill.ts',
      // A bin a workspace package publishes is what a consumer's npx runs.
      'npx texuli-init theme list',
      // MCP hosts document `npx -y <package>`, which runs the package's bin.
      'npx -y @texuli/mcp',
      'npx --yes @texuli/mcp --help',
      'texuli mcp',
      './skills/texuli/setup.sh --verify --expect-version 0.1.0',
      './texuli/setup.sh --verify --dir ./texuli --sums ./SHA256SUMS',
      'git merge --no-edit dev',
      'tar -xzf texuli-skill-0.1.0.tar.gz',
      'texuli theme preview <id>',
      'texuli catalog search --json \'{"query":"card"}\' --out <catalog.json>',
      'npx texuli deck run --file <input.json>',
      'pnpm exec tsx packages/tools/src/cli/texuli.ts deck lint --file <deck.json>',
      'texuli help',
      'texuli document --help',
    ]) {
      expect(checkCommand(line, ctx), line).toEqual([]);
    }
    // rejects network, missing and made-up commands
    {
      const cases: [string, RegExp][] = [
        ['curl -L https://example.com/x', /network/],
        ['pnpm dlx some-tool', /offline/],
        ['pnpm no-such-script', /no such root script/],
        ['pnpm --filter @texuli/nope build', /no such workspace package/],
        ['pnpm --filter texuli no-such-script', /no "no-such-script" script/],
        ['pnpm vitest run packages/nope/tests/missing.test.ts', /does not exist/],
        ['pnpm exec tsx scripts/missing.ts', /does not exist/],
        ['npx cowsay hi', /would download/],
        ['npx -y cowsay', /would download/],
        ['npx -y @texuli/core', /would download/],
        ['./skills/texuli/setup.sh --frobnicate', /no --frobnicate option/],
        ['git push origin main', /remote/],
        ['git remote add origin x', /remote/],
        ['texuli explode', /Unknown texuli command "explode"/],
        // The router parses every `texuli …` form: verbs, flags and kept commands.
        ['texuli catalog find', /Unknown verb "find" for texuli catalog/],
        ['texuli catalog search --frob', /Unknown flag "--frob"/],
        ['texuli deck explode --file <deck.json>', /Unknown deck command/],
        ['npx texuli theme apply', /theme id is required/],
        [
          'pnpm exec tsx packages/tools/src/cli/texuli.ts document validate --key k',
          /only for to-blueprint/,
        ],
        ['npx -y @texuli/mcp --port 4000', /Unknown texuli mcp argument/],
        ['make everything', /unknown command/],
      ];
      for (const [line, message] of cases) {
        const problems = checkCommand(line, ctx);
        expect(problems.length, line).toBe(1);
        expect(problems[0], line).toMatch(message);
      }
    }
    // checks `texuli …` references in prose, not inside code fences
    {
      const markdown =
        'Run `texuli theme preview <id>` then `texuli explode`.\n\n```text\ntexuli whatever\n```\n';
      expect(checkCliReferences(markdown, ctx)).toEqual([
        { line: 1, message: '`texuli explode` is not a Texuli CLI command' },
      ]);
    }
    // checks MCP operation names and argument keys cited in prose
    {
      const markdown = [
        'Call `catalog.search { "query": "card", "limit": 5 }` then `component.get`.',
        'Not operations: `example.com`, `theme.light`, `catalog.json`.',
        'Typos: `catalog.find`, `theme.get { "name": "violet" }`, `deck.run {}`, `catalog.search { nope`.',
        '```text',
        'catalog.find inside a fence is not prose',
        '```',
      ].join('\n');
      expect(checkOperationReferences(markdown)).toEqual([
        { line: 3, message: '`catalog.find` is not a Texuli operation' },
        { line: 3, message: 'theme.get has no argument "name" (arguments: id)' },
        { line: 3, message: 'theme.get needs the argument "id"' },
        { line: 3, message: 'deck.run needs the argument "command"' },
      ]);
    }
    // checks Texuli imports against real package exports
    {
      const ok = `import { Rating } from 'texuli/rating';\nimport { createRovingFocus } from '@texuli/core/roving';\nimport { cx } from '../../internal/cx.ts';\nimport { mount } from 'svelte';`;
      expect(checkSnippetImports(ok, root)).toEqual([]);
      expect(checkSnippetImports("import { x } from '@texuli/core/nope';", root)).toEqual([
        '@texuli/core/nope: @texuli/core does not export "./nope"',
      ]);
      expect(checkSnippetImports("import { x } from '@texuli/missing';", root)).toEqual([
        '@texuli/missing: no workspace package @texuli/missing',
      ]);
    }
    // reports bad snippets and commands in a pack with file and line
    {
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
    }
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

  it('--version prints the pack version; --verify passes with the matching pin and refuses another version; a mismatched pin writes nothing; a matching pin installs; --expect-version needs a value', async () => {
    // --version prints the pack version
    {
      const { code, out } = await run(['--version']);
      expect(code).toBe(0);
      expect(out.trim()).toBe(version);
    }
    // --verify passes with the matching pin and refuses another version
    {
      const ok = await run(['--verify', '--expect-version', version]);
      expect(ok.code, ok.out).toBe(0);
      expect(ok.out).toContain(`pinned version: ${version} (matches)`);
      const wrong = await run(['--verify', '--expect-version', '9.9.9']);
      expect(wrong.code).toBe(1);
      expect(wrong.out).toContain(`pinned to version 9.9.9, but`);
      // Hashes every pack file with the system shasum: seconds under a loaded machine.
    }
    // a mismatched pin writes nothing; a matching pin installs
    {
      const home = tempDir();
      const refused = await run(['--host', 'claude', '--home', home, '--expect-version', '9.9.9']);
      expect(refused.code).toBe(1);
      expect(readdirSync(home)).toEqual([]);
      const installed = await run([
        '--host',
        'claude',
        '--home',
        home,
        '--expect-version',
        version,
      ]);
      expect(installed.code, installed.out).toBe(0);
      expect(readFileSync(join(home, '.claude', 'skills', 'texuli', 'SKILL.md'), 'utf8')).toContain(
        `version: "${version}"`
      );
    }
    // --expect-version needs a value
    {
      const { code, out } = await run(['--verify', '--expect-version']);
      expect(code).toBe(2);
      expect(out).toContain('--expect-version needs a version');
    }
  }, 30000);
});

describe('publishing standard (frontmatter limits, budgets, version, mirror)', () => {
  const frontmatter = (fields: Record<string, string>) =>
    `---\n${Object.entries({
      name: 'texuli',
      description: 'Router skill.',
      version: '"0.1.0"',
      documentation_url: 'https://texuli.com/guides/',
      'user-invocable': 'true',
      'allowed-tools': 'Bash, Read',
      metadata:
        '{"openclaw":{"emoji":"x","homepage":"https://texuli.com/guides/","requires":{"anyBins":["bash"]}}}',
      ...fields,
    })
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')}\n---\n`;

  it('rejects nested YAML metadata, a name over 64 characters and a description over 1024', () => {
    const fields = (source: string) =>
      validateFrontmatterParsed('SKILL.md', parseFrontmatter(source)).map((i) => i.field);
    expect(fields(frontmatter({}))).toEqual([]);
    const nested = frontmatter({}).replace(
      /^metadata: .*$/m,
      'metadata:\n  openclaw:\n    emoji: x\n    homepage: https://texuli.com/guides/\n    requires:\n      anyBins:\n        - bash'
    );
    expect(fields(nested)).toEqual(['metadata']);
    expect(fields(frontmatter({ name: `texuli-${'a'.repeat(NAME_MAX)}` }))).toEqual(['name']);
    expect(fields(frontmatter({ description: 'x'.repeat(DESCRIPTION_MAX + 1) }))).toEqual([
      'description',
    ]);
    expect(fields(frontmatter({ metadata: '{"openclaw": broken}' }))).toContain(
      'metadata.openclaw'
    );
  });

  it('keeps every SKILL.md and entry bundle within its byte budget, and every version on the router', () => {
    // Measured 2026-10-27 at 0.2.0 (before T-skill-current): the largest
    // SKILL.md was media/SKILL.md at 10,711 bytes and the largest bundle
    // evals at 42,278 bytes. Raising a budget is a reviewed decision.
    expect(SKILL_MD_BUDGET).toBe(16_384);
    expect(BUNDLE_BUDGET).toBe(65_536);
    expect(checkBudgets(skillRoot)).toEqual([]);
    const bundles = skillBundles(skillRoot);
    expect(bundles.map((bundle) => bundle.entry).sort()).toEqual(skillMdPaths(skillRoot).sort());
    // Every pack file except the manifest and the changelog belongs to exactly one bundle.
    const owned = bundles.flatMap((bundle) => bundle.files).sort();
    expect(new Set(owned).size).toBe(owned.length);
    expect(owned).toContain('router/routes.md');
    expect(owned).toContain('upgrade/SKILL.md');
    expect(owned).not.toContain('CHANGELOG.md');
    // A temp pack over budget is reported for the SKILL.md and its bundle.
    const pack = tempDir();
    mkdirSync(join(pack, 'big', 'references'), { recursive: true });
    writeFileSync(join(pack, 'SKILL.md'), 'x');
    writeFileSync(join(pack, 'big', 'SKILL.md'), 'x'.repeat(SKILL_MD_BUDGET + 1));
    writeFileSync(join(pack, 'big', 'references', 'a.md'), 'x'.repeat(BUNDLE_BUDGET));
    expect(checkBudgets(pack).map((i) => `${i.file} ${i.field}`)).toEqual([
      'big/SKILL.md budget',
      'big/SKILL.md bundle',
    ]);
    expect(checkVersionSync(skillRoot)).toEqual([]);
  });

  it('keeps the dogfood mirror byte-identical to the pack, with its skills-lock.json hash', () => {
    const mirror = join(root, '.agents', 'skills', 'texuli');
    expect(mirrorDifferences(root)).toEqual([]);
    expect(checkMirror(root)).toEqual([]);
    const lock = JSON.parse(readFileSync(join(root, 'skills-lock.json'), 'utf8'));
    expect(lock.skills.texuli).toMatchObject({
      source: 'DailybotHQ/texuli',
      skillPath: 'skills/texuli/SKILL.md',
      computedHash: skillFolderHash(mirror),
    });
    // The algorithm reproduces an entry the real skills CLI wrote.
    expect(skillFolderHash(join(root, '.agents', 'skills', 'ai-diff-reviewer'))).toBe(
      lock.skills['ai-diff-reviewer'].computedHash
    );
  });

  it('allows only pinned Texuli downloads, and only in the upgrade and pinned-install files', () => {
    for (const line of [
      "git ls-remote --tags --refs https://github.com/DailybotHQ/texuli.git 'skill-v*'",
      'curl -fsSLO https://github.com/DailybotHQ/texuli/releases/download/skill-v<version>/texuli-skill-<version>.tar.gz',
      'curl -fsSLO https://github.com/DailybotHQ/texuli/releases/download/skill-v0.3.0/SHA256SUMS',
      'npx --yes skills add https://github.com/DailybotHQ/texuli/tree/skill-v0.3.0/skills/texuli --skill texuli -y',
      'npx skills remove texuli -g',
    ]) {
      expect(isPinnedNetworkCommand(line), line).toBe(true);
    }
    for (const line of [
      // The shorthand's ref can be ignored by the skills CLI.
      'npx skills add DailybotHQ/texuli@skill-v0.3.0',
      'npx skills add https://github.com/DailybotHQ/texuli/tree/main/skills/texuli',
      'curl -fsSLO https://example.com/skill-v1.0.0/SHA256SUMS',
      'git clone https://github.com/DailybotHQ/texuli.git',
    ]) {
      expect(isPinnedNetworkCommand(line), line).toBe(false);
    }
    const pack = tempDir();
    const fence =
      '```bash\ncurl -fsSLO https://github.com/DailybotHQ/texuli/releases/download/skill-v1.0.0/SHA256SUMS\n```\n';
    mkdirSync(join(pack, 'upgrade'));
    writeFileSync(join(pack, 'upgrade', 'SKILL.md'), fence);
    writeFileSync(join(pack, 'GUIDE.md'), fence);
    expect(validateSkillCommands(pack, root).map((i) => `${i.file} ${i.field}`)).toEqual([
      'GUIDE.md command:2',
    ]);
  });

  it('setup.sh installs into every host it lists, idempotently, under a temp home', async () => {
    // The evidence behind the "install-tested" cells of docs/SKILL_COMPATIBILITY.md.
    const { execFileSync, spawnSync } = await import('node:child_process');
    const setup = join(skillRoot, 'setup.sh');
    const hosts = execFileSync('bash', [setup, '--list-hosts'], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/) as [string, string]);
    expect(hosts.map(([host]) => host)).toEqual([
      'claude',
      'cursor',
      'codex',
      'gemini',
      'copilot',
      'opencode',
      'windsurf',
    ]);
    const home = tempDir();
    for (const [host, folder] of hosts) {
      const target = join(home, folder.replace(/^~\//, ''));
      const first = spawnSync('bash', [setup, '--host', host, '--home', home], {
        encoding: 'utf8',
      });
      expect(first.status, `${host}: ${first.stderr}`).toBe(0);
      expect(verifySkillChecksums(target), host).toEqual([]);
      const again = spawnSync('bash', [setup, '--host', host, '--home', home], {
        encoding: 'utf8',
      });
      expect(again.status, host).toBe(0);
      expect(again.stdout, host).toContain('Already installed: no change.');
    }
    // Non-clobbering: an unrelated folder is refused (exit 3) and left as is;
    // another Texuli version needs --replace, which keeps the old copy.
    const other = tempDir();
    const unrelated = join(other, '.claude', 'skills', 'texuli');
    mkdirSync(unrelated, { recursive: true });
    writeFileSync(join(unrelated, 'notes.txt'), 'mine\n');
    const refused = spawnSync('bash', [setup, '--host', 'claude', '--home', other], {
      encoding: 'utf8',
    });
    expect(refused.status).toBe(3);
    expect(readdirSync(unrelated)).toEqual(['notes.txt']);
    const older = join(home, '.claude', 'skills', 'texuli', 'SKILL.md');
    writeFileSync(
      older,
      readFileSync(older, 'utf8').replace(/^version: ".*"$/m, 'version: "0.0.1"')
    );
    const blocked = spawnSync('bash', [setup, '--host', 'claude', '--home', home], {
      encoding: 'utf8',
    });
    expect(blocked.status).toBe(3);
    const replaced = spawnSync('bash', [setup, '--host', 'claude', '--home', home, '--replace'], {
      encoding: 'utf8',
    });
    expect(replaced.status, replaced.stderr).toBe(0);
    expect(verifySkillChecksums(join(home, '.claude', 'skills', 'texuli'))).toEqual([]);
    const backups = readdirSync(join(home, '.texuli', 'skill-backups'));
    expect(backups).toHaveLength(1);
    expect(
      readFileSync(
        join(home, '.texuli', 'skill-backups', backups[0] as string, 'texuli', 'SKILL.md'),
        'utf8'
      )
    ).toContain('version: "0.0.1"');
  }, 60000);
});
