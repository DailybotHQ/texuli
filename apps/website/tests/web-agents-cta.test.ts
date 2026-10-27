/**
 * T-43 — the unified landing's agents + closing CTA section
 * (`WebAgentsCta.astro` + `web-agents-content.ts`).
 *
 * The vitest suite cannot compile .astro templates, so the tests pin the
 * section at its two seams:
 *
 *  1. the content module — the agent story's steps anchor to repository
 *     files, every agent surface is a real served artifact in this
 *     checkout (llms.txt, a markdown twin, the .well-known files, the
 *     skill page), and the install block ships the real `next`-tag
 *     command with the honest 1.0.0 line;
 *  2. the section template, read as source — landmark/heading order, the
 *     URL policy on every rendered link, no HTML sinks, the copy button
 *     wired through the analytics `code_copy` seam exactly like
 *     CopyPage.astro, and the style contract.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  WEB_AGENTS_CTA_LINKS,
  WEB_AGENTS_IDS,
  WEB_AGENTS_INSTALL,
  WEB_AGENTS_LEDE,
  WEB_AGENTS_STEPS,
  WEB_AGENTS_SURFACES,
} from '../src/components/sections/web/web-agents-content.ts';

function findRepoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`repository root not found from ${process.cwd()}`);
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot();
const SECTION_FILE = 'apps/website/src/components/sections/web/WebAgentsCta.astro';
const SECTION_DIR = 'apps/website/src/components/sections/web';

const readRepo = (relativePath: string): string =>
  readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
const normalize = (text: string): string => text.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();

const sectionSource = readRepo(SECTION_FILE);
const template = sectionSource.slice(
  sectionSource.indexOf('---', sectionSource.indexOf('---') + 3) + 3
);
const style = sectionSource.slice(sectionSource.lastIndexOf('<style>'));

interface CopyPiece {
  name: string;
  text: string;
  sources: { file: string; phrase: string }[];
}

const copyPieces: CopyPiece[] = [
  { name: 'lede', text: WEB_AGENTS_LEDE.text, sources: WEB_AGENTS_LEDE.sources },
  ...WEB_AGENTS_STEPS.map((step) => ({
    name: `step "${step.title}"`,
    text: step.body,
    sources: step.sources,
  })),
];

const citations = copyPieces.flatMap((piece) =>
  piece.sources.map((source) => ({ ...source, piece: piece.name, copy: piece.text }))
);
const sectionCopy = normalize(copyPieces.map((piece) => piece.text).join(' '));

describe('every claim is anchored in the file it cites (no drift)', () => {
  it.each(citations)('$piece anchors "$phrase"', ({ file, phrase, copy }) => {
    expect(normalize(readRepo(file))).toContain(normalize(phrase));
    expect(normalize(copy)).toContain(normalize(phrase));
  });

  it('cites only real repository files', () => {
    const files = new Set(citations.map((citation) => citation.file));
    for (const file of files) expect(readRepo(file).length).toBeGreaterThan(0);
  });
});

describe('the agent story walks the catalog-to-interface path', () => {
  it('has the three story steps: closed catalog, safe renderer, any interface', () => {
    expect(WEB_AGENTS_STEPS).toHaveLength(3);
    expect(sectionCopy.toLowerCase()).toContain('closed catalog');
    expect(sectionCopy.toLowerCase()).toContain('sink-free');
    expect(sectionCopy.toLowerCase()).toContain('hostile');
  });
});

describe('every agent surface is a real served artifact', () => {
  it('lists the five surfaces: llms.txt, markdown twins, .well-known catalog, MCP card, skill', () => {
    expect(WEB_AGENTS_SURFACES.map((surface) => surface.href)).toEqual([
      '/llms.txt',
      '/llms/components/badge.md',
      '/.well-known/ai-catalog.json',
      '/.well-known/mcp/server-card.json',
      '/skill/',
    ]);
  });

  it.each(WEB_AGENTS_SURFACES.map((surface) => [surface.href, surface.label] as const))(
    '%s (%s) exists as a served file or page in this checkout',
    (href) => {
      if (href.endsWith('/')) {
        expect(existsSync(resolve(REPO_ROOT, `apps/website/src/pages${href}`, 'index.astro'))).toBe(
          true
        );
        return;
      }
      expect(existsSync(resolve(REPO_ROOT, `apps/website/public${href}`))).toBe(true);
    }
  );

  it('the markdown twin it links really describes the same badge component', () => {
    const twin = readRepo('apps/website/public/llms/components/badge.md');
    expect(twin).toContain('# Badge');
    expect(twin).toContain('A compact status or category label.');
  });

  it('the MCP surface it links describes the local read-only server', () => {
    const card = readRepo('apps/website/public/.well-known/mcp/server-card.json');
    expect(card).toContain('Read-only MCP server over the Texuli catalog and themes');
  });
});

describe('the install block is the real preview install, honestly framed', () => {
  it('ships the real pnpm command with the next dist-tag', () => {
    expect(WEB_AGENTS_INSTALL.command).toBe('pnpm add texuli@next');
  });

  it('the honesty line pins the shipped preview version and reserves latest for 1.0.0', () => {
    expect(WEB_AGENTS_INSTALL.note).toContain('0.1.0-next.1');
    expect(WEB_AGENTS_INSTALL.note).toContain('next');
    expect(WEB_AGENTS_INSTALL.note).toContain('1.0.0');
    expect(WEB_AGENTS_INSTALL.note.toLowerCase()).toContain('nothing stable');
  });

  it.each([/coming soon/i, /production-ready/i, /\b20\d\d\b/, /Q[1-4] 20\d\d/])(
    'the install note never matches the banned claim %s',
    (banned) => {
      expect(banned.test(WEB_AGENTS_INSTALL.note)).toBe(false);
    }
  );

  it('renders the command as text in a labelled region, not through a sink', () => {
    expect(template).toContain('<code>{WEB_AGENTS_INSTALL.command}</code>');
    expect(template).not.toContain('{@html');
    expect(template).not.toContain('set:html');
    expect(sectionSource).not.toContain('innerHTML');
  });
});

describe('the closing CTA links real routes through the URL policy', () => {
  it('keeps the playground as the primary CTA of the agents story', () => {
    expect(WEB_AGENTS_CTA_LINKS[0]).toMatchObject({ href: '/playground/', role: 'primary' });
  });

  it.each([...WEB_AGENTS_CTA_LINKS, ...WEB_AGENTS_SURFACES].map((link) => [link.href] as const))(
    'route %s is on-site and exists',
    (href) => {
      expect(href.startsWith('/')).toBe(true);
      expect(href).not.toMatch(/^https?:/);
      if (href.endsWith('/')) {
        expect(existsSync(resolve(REPO_ROOT, `apps/website/src/pages${href}`, 'index.astro'))).toBe(
          true
        );
      }
    }
  );

  it('resolves every rendered link through safeHref at the developer tier', () => {
    expect(sectionSource).toContain("safeHref(href, 'developer')");
    expect(template).toContain('href={resolveHref(link.href)}');
    expect(template.match(/href="\/[^"]*"/g) ?? []).toEqual([]);
  });
});

describe('the copy button rides the analytics code-copy seam like CopyPage', () => {
  it('imports the site lib events and track, not a bespoke event name', () => {
    const copyModule = readRepo(`${SECTION_DIR}/web-copy-command.ts`);
    expect(copyModule).toContain("from '../../../lib/analytics.ts'");
    expect(copyModule).toContain("from '../../../lib/track.ts'");
    expect(copyModule).toContain('EVENTS.CODE_COPY');
  });

  it('fires the event only after the clipboard write succeeds', () => {
    const copyModule = readRepo(`${SECTION_DIR}/web-copy-command.ts`);
    const afterWrite = copyModule.indexOf('navigator.clipboard.writeText');
    const trackCall = copyModule.indexOf('track(');
    const catchBlock = copyModule.indexOf('catch', afterWrite);
    expect(afterWrite).toBeGreaterThan(-1);
    expect(trackCall).toBeGreaterThan(afterWrite);
    expect(trackCall).toBeLessThan(catchBlock);
  });

  it('wires the button through the module script with a status region', () => {
    expect(template).toContain('wireCopyCommand(host)');
    expect(template).toMatch(/role="status"/);
    expect(template).toMatch(/data-copy-command-button/);
    expect(template).toMatch(/data-copy-command-text/);
  });
});

describe('section structure and landmarks', () => {
  it('gives every heading a unique id for aria-labelledby', () => {
    const ids = Object.values(WEB_AGENTS_IDS);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^web-/);
  });

  it('renders one labelled section landmark named by its h2', () => {
    const sections = template.match(/<section[^>]*>/g) ?? [];
    expect(sections).toHaveLength(1);
    expect(sections[0]).toContain(`aria-labelledby={WEB_AGENTS_IDS.section}`);
    expect(sections[0]).toContain('data-tx-web-agents');
    expect(template).toContain('<h2 id={WEB_AGENTS_IDS.section}>');
  });

  it('keeps heading order h2 then the story, surfaces and install h3s', () => {
    const levels = [...template.matchAll(/<h([1-6])\b/g)].map((match) => match[1]);
    expect(levels).toEqual(['2', '3', '3', '3']);
  });
});

describe('the style contract', () => {
  it('styles through --tx-* tokens and logical properties only', () => {
    expect(style).toMatch(/var\(--tx-/);
    expect(style).toMatch(/inline-size/);
    for (const physical of [
      /[^-]margin-left:/,
      /[^-]margin-right:/,
      /[^-]padding-left:/,
      /[^-]padding-right:/,
      /[^-](left|right):/,
      /text-align:\s*(left|right)/,
    ]) {
      expect(physical.test(style)).toBe(false);
    }
  });

  it('stays fluid at 360px and adapts at the desktop breakpoint', () => {
    expect(style).toMatch(/clamp\(/);
    expect(style).toMatch(/@media \(min-width: 56rem\)/);
    expect(style).toMatch(/@media \(forced-colors: active\)/);
  });

  it('animates nothing except the one copy action it owns', () => {
    expect(style).not.toMatch(/animation/);
    expect(style).not.toMatch(/transition/);
  });
});
