/// <reference types="node" />

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, relative, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import {
  hostCommands,
  parseChecksums,
  parseFrontmatter,
  parseHostLabels,
  parseSetupHosts,
  skillHosts,
  subSkills,
} from '../../apps/website/src/components/skill/skill.ts';
import { primaryNav } from './support/site-nav.ts';

/*
 * texuli.com skill page (apps/website/src/pages/skill). Built static site only
 * — run `pnpm build` first. The page is built from skills/texuli itself; these
 * checks hold it to the pack and to setup.sh's real output. No foreign
 * network; axe in light and dark.
 */

const DIST = resolve('apps/website/dist');
const PACK = resolve('skills/texuli');
const SETUP = join(PACK, 'setup.sh');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const read = (path: string) => readFileSync(join(PACK, path), 'utf8');
const ROUTER = parseFrontmatter(read('SKILL.md'));
const CHECKSUMS = parseChecksums(read('SHA256SUMS'));
const HOSTS = skillHosts(read('setup.sh'), read('router/hosts.md'), 'texuli');
const setup = (...args: string[]) =>
  execFileSync('sh', [SETUP, ...args], { encoding: 'utf8', timeout: 60_000 });

function packFiles(dir = PACK): Map<string, string> {
  const files = new Map<string, string>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) for (const [k, v] of packFiles(full)) files.set(k, v);
    else files.set(relative(PACK, full).split('\\').join('/'), readFileSync(full, 'utf8'));
  }
  return files;
}

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'skill', 'index.html'))) {
    throw new Error('Skill page missing from dist — run `pnpm build` first.');
  }
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://site').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) file = join(DIST, '404');
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => new Promise<void>((done) => server.close(() => done())));

async function visit(page: Page, path = '/skill/') {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin)) foreign.push(request.url());
  });
  await page.goto(`${origin}${path}`);
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.txPageReady === 'true' ||
      (!document.querySelector('script[data-tx-ready-script]') &&
        document.readyState === 'complete'),
    undefined,
    { polling: 250 }
  );
  return foreign;
}

test.describe('texuli.com skill page: data', () => {
  test.beforeEach(({ browserName }, info) => {
    void browserName;
    test.skip(info.project.name !== 'chromium', 'the data checks are browser-independent');
  });

  test('parses frontmatter, the host map and SHA256SUMS', () => {
    expect(
      parseFrontmatter(
        '---\nname: demo\ndescription: Does a thing.\nversion: "1.2.3"\nallowed-tools: Bash, Read\nmetadata:\n  x: y\n---\n# Body'
      )
    ).toEqual({
      name: 'demo',
      description: 'Does a thing.',
      version: '1.2.3',
      allowedTools: ['Bash', 'Read'],
    });
    expect(
      parseSetupHosts(
        'HOSTS="a b"\nhost_dir() {\n  case "$1" in\n    a) echo ".a/skills" ;;\n    b) echo ".b/x" ;;\n  esac\n}\n'
      )
    ).toEqual([
      { id: 'a', dir: '.a/skills' },
      { id: 'b', dir: '.b/x' },
    ]);
    expect([
      ...parseHostLabels(
        '| Host | `setup.sh --host` | x |\n| Claude Code | `claude` | `~/.claude` |'
      ),
    ]).toEqual([['claude', 'Claude Code']]);
    const hash = 'a'.repeat(64);
    expect(parseChecksums(`${hash}  SKILL.md\n\nnot a line\n${hash} *setup.sh\n`)).toEqual([
      { hash, path: 'SKILL.md' },
      { hash, path: 'setup.sh' },
    ]);
  });

  test('the hosts are exactly what setup.sh --list-hosts prints', () => {
    const listed = setup('--list-hosts')
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/));
    expect(HOSTS.map((host) => [host.id, host.folder])).toEqual(listed);
    for (const host of HOSTS) expect(host.label, host.id).not.toBe(host.id);
  });

  test('the version is what setup.sh --version prints, and the pack verifies', () => {
    expect(setup('--version').trim()).toContain(ROUTER.version);
    expect(() => setup('--verify', '--expect-version', ROUTER.version)).not.toThrow();
  });

  test('every checksum is the file it names, and every pack file is listed', () => {
    const files = packFiles();
    files.delete('SHA256SUMS');
    expect(CHECKSUMS.map((sum) => sum.path).sort()).toEqual([...files.keys()].sort());
    for (const sum of CHECKSUMS) {
      const actual = createHash('sha256')
        .update(readFileSync(join(PACK, sum.path)))
        .digest('hex');
      expect(actual, sum.path).toBe(sum.hash);
    }
  });

  test('finds every sub-skill with its frontmatter and references', () => {
    const skills = subSkills(packFiles(), CHECKSUMS);
    const folders = readdirSync(PACK, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(PACK, entry.name, 'SKILL.md')))
      .map((entry) => entry.name)
      .sort();
    expect(skills.map((skill) => skill.folder)).toEqual(folders);
    for (const skill of skills) {
      expect(skill.name, skill.folder).toBe(`texuli-${skill.folder}`);
      expect(skill.description, skill.folder).not.toBe('');
      expect(skill.version, skill.folder).toBe(ROUTER.version);
      const refs = join(PACK, skill.folder, 'references');
      if (existsSync(refs)) expect(skill.references.sort()).toEqual(readdirSync(refs).sort());
    }
  });
});

test.describe('texuli.com skill page', () => {
  test('explains the skill, its version and its trust boundary', async ({ page }) => {
    expect(await visit(page)).toEqual([]);
    await expect(page).toHaveTitle('The Texuli skill · Texuli');
    await expect(page.getByRole('heading', { level: 1, name: 'The Texuli skill' })).toBeVisible();
    await expect(
      (await primaryNav(page)).getByRole('link', { name: 'Skill', exact: true })
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-skill-name]')).toHaveText(ROUTER.name);
    await expect(page.locator('[data-skill-version]')).toHaveText(ROUTER.version);
    await expect(page.getByRole('heading', { level: 2, name: 'What it may do' })).toBeVisible();
    await expect(page.getByText('No network', { exact: true })).toBeVisible();
  });

  test('shows the install commands for every host setup.sh supports', async ({ page }) => {
    await visit(page);
    await expect(page.locator('[data-host]')).toHaveCount(HOSTS.length);
    for (const host of HOSTS) {
      const card = page.locator(`[data-host="${host.id}"]`);
      await expect(card.getByRole('heading', { level: 3, name: host.label })).toBeVisible();
      await expect(card).toContainText(host.folder);
      await expect(card.locator('pre')).toHaveText(
        hostCommands(host.id, ROUTER.version).join('\n')
      );
    }
  });

  test('describes every sub-skill from its own SKILL.md', async ({ page }) => {
    await visit(page);
    const skills = subSkills(packFiles(), CHECKSUMS);
    await expect(page.locator('[data-subskill]')).toHaveCount(skills.length);
    for (const skill of skills) {
      const card = page.locator(`[data-subskill="${skill.folder}"]`);
      await expect(card.getByRole('heading', { level: 3, name: skill.name })).toBeVisible();
      await expect(card).toContainText(skill.description);
    }
  });

  test('lists every checksum, and the hash of SHA256SUMS itself', async ({ page }) => {
    await visit(page);
    const sums = createHash('sha256')
      .update(readFileSync(join(PACK, 'SHA256SUMS')))
      .digest('hex');
    await expect(page.locator('[data-sums-sha256]')).toHaveText(sums);
    const summary = page.getByText(`All ${CHECKSUMS.length} files`);
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-sum]')).toHaveCount(CHECKSUMS.length);
    for (const sum of CHECKSUMS) {
      const row = page.locator(`[data-sum="${sum.path}"]`);
      await expect(row).toBeVisible();
      await expect(row.locator('dd')).toHaveText(sum.hash);
    }
  });

  test('fits the viewport: no horizontal scrolling, commands wrap', async ({ page }) => {
    await visit(page);
    await page.evaluate(() => {
      for (const details of document.querySelectorAll('details')) details.open = true;
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe with the checksums open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      expect(await visit(page)).toEqual([]);
      expect(await page.locator('html').getAttribute('data-tx-mode')).toBe(scheme);
      await page.evaluate(() => {
        for (const details of document.querySelectorAll('details')) details.open = true;
      });
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
        )
      ).toEqual([]);
    });
  }
});
