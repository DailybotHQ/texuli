// @vitest-environment node
/// <reference types="node" />
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile as writeFileSync,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CatalogManifest } from '@texuli/catalog/manifest';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildLlmsBundle,
  componentDocPath,
  formatComponentMarkdown,
  formatLlmsTxt,
  parseLlmsArgs,
  writeLlmsBundle,
} from '../src/llms/index.ts';

const temps: string[] = [];

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

const card: CatalogManifest = {
  id: 'card',
  package: 'texuli',
  label: 'Card',
  summary: 'A surface for grouping related content.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Group related content'],
  dontUseWhen: ['A single line of chrome'],
  a11y: ['Interactive cards are real links with names'],
  props: [
    {
      name: 'variant',
      kind: 'enum',
      enumValues: ['elevated', 'flat'],
      default: 'elevated',
      description: 'Visual elevation',
    },
    { name: 'title', kind: 'string', description: 'Optional title' },
    { name: 'class', kind: 'string', description: 'Host classes (not for agents)' },
  ],
  examples: [
    {
      id: 'elevated',
      title: 'Elevated card',
      description: 'Default elevation',
      props: { variant: 'elevated', title: 'Harbor' },
    },
  ],
  related: ['badge'],
};

const blocksText: CatalogManifest = {
  id: 'blocks-text',
  package: '@texuli/blocks',
  label: 'Text block',
  summary: 'Validated text content blocks.',
  tier: 'content',
  agentEmittable: true,
  useWhen: ['Render authored text blocks'],
  dontUseWhen: ['Free-form HTML'],
  a11y: ['Headings keep a logical outline'],
  props: [
    {
      name: 'block',
      kind: 'object',
      required: true,
      trust: 'untrusted',
      description: 'Untrusted block data',
    },
  ],
  examples: [
    {
      id: 'heading',
      title: 'Heading',
      props: { block: { type: 'heading', level: 2, text: 'Quarterly update' } },
    },
  ],
};

describe('format helpers', () => {
  it('builds component Markdown with props table and examples', () => {
    const md = formatComponentMarkdown(card, { baseUrl: 'https://ex.example/llms' });
    expect(md).toContain('# Card');
    expect(md).toContain('**id:** `card`');
    expect(md).toContain('| `variant` |');
    expect(md).toContain('enum(elevated | flat)');
    expect(md).toContain('### Examples');
    expect(md).toContain('"variant": "elevated"');
    expect(md).toContain('[`badge`](https://ex.example/llms/components/badge.md)');
    expect(md).not.toMatch(/<script/i);
  });

  it('builds llms.txt with tier split and stable links', () => {
    const txt = formatLlmsTxt([card, blocksText], {
      title: 'Texuli',
      baseUrl: '',
      splitTiers: true,
    });
    expect(txt.startsWith('# Texuli\n')).toBe(true);
    expect(txt).toContain('## Agent-emittable components');
    expect(txt).toContain('- [Text block](components/blocks-text.md):');
    expect(txt).toContain('## App and chrome components');
    expect(txt).toContain('- [Card](components/card.md):');
    expect(txt).toContain('llms-full.txt');
  });
});

describe('buildLlmsBundle', () => {
  it('returns llms.txt, llms-full.txt and per-component files sorted', () => {
    const bundle = buildLlmsBundle({
      manifests: [blocksText, card],
      title: 'Texuli Test',
    });
    expect(bundle.entryCount).toBe(2);
    expect(bundle.llmsTxt).toContain('# Texuli Test');
    expect(bundle.llmsFullTxt).toContain('# Card');
    expect(bundle.llmsFullTxt).toContain('# Text block');
    expect(bundle.components.map((f) => f.path)).toEqual([
      'components/blocks-text.md',
      'components/card.md',
    ]);
    expect(bundle.files.map((f) => f.path)).toEqual([
      'components/blocks-text.md',
      'components/card.md',
      'llms-full.txt',
      'llms.txt',
    ]);
    expect(componentDocPath('card')).toBe('components/card.md');
  });

  it('links related components from where each file sits', () => {
    const bundle = buildLlmsBundle({ manifests: [blocksText, card] });
    const page = bundle.components.find((file) => file.path === 'components/card.md');
    // components/card.md → components/badge.md is a sibling link…
    expect(page?.body).toContain('[`badge`](badge.md)');
    // …while llms-full.txt sits beside components/.
    expect(bundle.llmsFullTxt).toContain('[`badge`](components/badge.md)');
  });

  it('requires catalog or manifests', () => {
    expect(() => buildLlmsBundle({})).toThrow(/catalog or manifests/);
  });
});

describe('writeLlmsBundle', () => {
  it('writes the bundle to disk', async () => {
    const out = await tempDir('texuli-llms-');
    const bundle = buildLlmsBundle({ manifests: [card, blocksText] });
    const result = await writeLlmsBundle(out, bundle);
    expect(result.dryRun).toBe(false);
    expect(result.written).toContain('llms.txt');
    expect(result.written).toContain('components/card.md');

    const index = await readFile(join(out, 'llms.txt'), 'utf8');
    expect(index).toContain('[Card](components/card.md)');
    const full = await readFile(join(out, 'llms-full.txt'), 'utf8');
    expect(full).toContain('# Card');
    const cardMd = await readFile(join(out, 'components/card.md'), 'utf8');
    expect(cardMd).toContain('**package:** `texuli`');
  });

  it('refuses a ".." path that escapes outDir (nothing written)', async () => {
    const out = await tempDir('texuli-llms-dotdot-');
    const outside = await tempDir('texuli-llms-outside-');
    const marker = join(outside, 'marker.txt');
    await writeFileSync(marker, 'safe', 'utf8');

    const bundle = buildLlmsBundle({ manifests: [card] });
    await expect(
      writeLlmsBundle(out, {
        ...bundle,
        files: [{ path: '../escape.md', body: 'nope' }],
      })
    ).rejects.toThrow(/unsafe bundle path/);

    // outDir stays empty; outside marker untouched.
    await expect(readdir(out)).resolves.toEqual([]);
    await expect(readFile(marker, 'utf8')).resolves.toBe('safe');
  });

  it('refuses a symlinked destination file (nothing written through the link)', async () => {
    const out = await tempDir('texuli-llms-slink-file-');
    const outside = await tempDir('texuli-llms-slink-target-');
    const target = join(outside, 'secret.md');
    await writeFileSync(target, 'original', 'utf8');
    const linkPath = join(out, 'llms.txt');
    await symlink(target, linkPath);

    const bundle = buildLlmsBundle({ manifests: [card] });
    await expect(
      writeLlmsBundle(out, {
        ...bundle,
        files: [{ path: 'llms.txt', body: '# hijack\n' }],
      })
    ).rejects.toThrow(/symlink/i);

    await expect(readFile(target, 'utf8')).resolves.toBe('original');
  });

  it('refuses a symlinked parent directory (nothing written through the link)', async () => {
    const out = await tempDir('texuli-llms-slink-parent-');
    const outside = await tempDir('texuli-llms-slink-parent-target-');
    const componentsLink = join(out, 'components');
    await symlink(outside, componentsLink);

    const bundle = buildLlmsBundle({ manifests: [card] });
    await expect(
      writeLlmsBundle(out, {
        ...bundle,
        files: [{ path: 'components/card.md', body: '# hijack\n' }],
      })
    ).rejects.toThrow(/symlink/i);

    await expect(readdir(outside)).resolves.toEqual([]);
  });

  it('supports dry-run without creating component files', async () => {
    const out = await tempDir('texuli-llms-dry-');
    await mkdir(out, { recursive: true });
    const bundle = buildLlmsBundle({ manifests: [card] });
    const result = await writeLlmsBundle(out, bundle, { dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.written).toContain('llms.txt');
    await expect(readFile(join(out, 'llms.txt'), 'utf8')).rejects.toThrow();
  });
});

describe('parseLlmsArgs', () => {
  it('parses flags', () => {
    expect(
      parseLlmsArgs(['--out', 'pub/llms', '--base-url', 'https://x.example', '--json'])
    ).toEqual({
      outDir: 'pub/llms',
      baseUrl: 'https://x.example',
      title: 'Texuli',
      dryRun: false,
      json: true,
      help: false,
    });
  });
});
