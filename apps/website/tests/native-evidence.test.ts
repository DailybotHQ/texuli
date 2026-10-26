import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NATIVE_LINKS,
  NATIVE_MODULES,
  NATIVE_PLANNED,
  NATIVE_SHIPPED,
  REGISTRY_FACTS,
} from '../src/components/sections/native/native-evidence-data.ts';

/**
 * T-47 unit gate for the /native/ evidence + roadmap section. The section
 * is static Astro (no island), so the rendered-DOM assertions belong to the
 * site-native e2e spec at integration; this suite pins everything the
 * section can only get wrong at build time:
 * - every repo path it shows exists in the checkout (render only what is
 *   real — no screenshots of things that do not exist);
 * - the cited facts are still said by the registry (native/README.md);
 * - planned items carry the planned marker under a visible "Planned"
 *   heading, and shipped items stay separated from them;
 * - the a11y baseline holds in the template (landmark named by its h2,
 *   heading order h2→h3, ids bound, no HTML sinks, text-only paths);
 * - the copy stays honest: no years, no promise dates, no "coming soon",
 *   and the in-development/Maven status is stated, not implied.
 */
/**
 * Vitest (vite-node) does not expose `import.meta.url` as a file URL, so
 * the repository root is found by walking up from the working directory to
 * the `pnpm-workspace.yaml` marker — robust to any cwd inside the checkout.
 */
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
const SECTION_PATH = 'apps/website/src/components/sections/native/NativeEvidenceRoadmap.astro';

const sectionTemplate = readFileSync(resolve(REPO_ROOT, SECTION_PATH), 'utf8');
const registry = readFileSync(resolve(REPO_ROOT, 'native/README.md'), 'utf8');

const allCopy = [
  NATIVE_MODULES.map((module) => `${module.name} ${module.role} ${module.path}`).join('\n'),
  ...NATIVE_SHIPPED,
  ...NATIVE_PLANNED,
  ...NATIVE_LINKS.map((link) => `${link.href} ${link.label}`),
].join('\n');

describe('native evidence: every shown repo path exists', () => {
  it('lists modules at all (an empty list would be a silent section)', () => {
    expect(NATIVE_MODULES.length).toBeGreaterThan(0);
    for (const module of NATIVE_MODULES) {
      expect(module.name.trim().length).toBeGreaterThan(0);
      expect(module.role.trim().length).toBeGreaterThan(0);
    }
  });

  it.each(NATIVE_MODULES.map((module) => [module.name, module.path] as const))(
    '%s exists at %s',
    (_name, path) => {
      expect(existsSync(resolve(REPO_ROOT, path)), `missing repo path: ${path}`).toBe(true);
    }
  );

  it('renders paths as code text, not links — the site does not mirror files', () => {
    expect(sectionTemplate).toContain('<code>{module.path}</code>');
    expect(sectionTemplate).not.toMatch(/<a[^>]*href=\{module\.path\}/);
    expect(sectionTemplate).not.toContain('<img');
    expect(sectionTemplate).not.toContain('<picture');
  });
});

describe('native evidence: sourced from the native registry, not hand-copied', () => {
  it.each(REGISTRY_FACTS.map((fact) => [fact] as const))('the registry says "%s"', (fact) => {
    expect(registry).toContain(fact);
  });

  it.each(NATIVE_MODULES.map((module) => [module.path] as const))(
    'the registry locates %s',
    (path) => {
      if (path === 'native/README.md') {
        expect(path.endsWith('README.md')).toBe(true);
        return;
      }
      const segments = path.split('/');
      // The registry locates artifacts in three ways: a full path, a
      // shorter path prefix (`packages/spec/generated/kotlin`,
      // `conformance/semantics.json`), or the bare module name in the
      // modules table (`texuli-spec`). One of them must hold.
      const mentioned =
        registry.includes(path) ||
        segments.some(
          (_segment, end) => end >= 2 && registry.includes(segments.slice(0, end).join('/'))
        ) ||
        registry.includes(segments[segments.length - 1]);
      expect(mentioned, `registry never names ${path}`).toBe(true);
    }
  );
});

describe('native roadmap: planned means planned', () => {
  it('keeps both columns populated', () => {
    expect(NATIVE_SHIPPED.length).toBeGreaterThan(0);
    expect(NATIVE_PLANNED.length).toBeGreaterThan(0);
  });

  it('renders shipped and planned items with their status markers', () => {
    expect(sectionTemplate).toMatch(
      /NATIVE_SHIPPED\.map\(\(item\)\s*=>\s*<li data-status="shipped">/
    );
    expect(sectionTemplate).toMatch(
      /NATIVE_PLANNED\.map\(\(item\)\s*=>\s*<li data-status="planned">/
    );
    // The site's planned-marker convention is a visible "Planned" heading
    // (slides page, editor page); the data attribute is the machine marker.
    expect(sectionTemplate).toContain('<h3 id={plannedTitleId}>Planned</h3>');
  });

  it('marks nothing planned that the roadmap claims as published', () => {
    for (const item of NATIVE_PLANNED) {
      expect(item).toMatch(/pending|planned|needs the owner|Planned/i);
    }
  });
});

describe('native evidence: a11y template baseline', () => {
  it('is a landmark named by its own h2', () => {
    expect(sectionTemplate).toMatch(/<section class="native-evidence" aria-labelledby=\{titleId\}/);
    expect(sectionTemplate).toContain('<h2 id={titleId}>');
  });

  it('keeps heading order h2 → h3 with no skipped or stolen levels', () => {
    expect(sectionTemplate).not.toContain('<h1');
    const h2Index = sectionTemplate.indexOf('<h2');
    const firstH3 = sectionTemplate.indexOf('<h3');
    expect(h2Index).toBeGreaterThanOrEqual(0);
    expect(firstH3).toBeGreaterThan(h2Index);
    expect(sectionTemplate).not.toContain('<h4');
  });

  it('binds every aria-labelledby and heading id to a defined constant', () => {
    const referenced = [...sectionTemplate.matchAll(/aria-labelledby=\{(\w+)\}/g)].map(
      (match) => match[1]
    );
    const defined = [...sectionTemplate.matchAll(/id=\{(\w+)\}/g)].map((match) => match[1]);
    expect(referenced.length).toBeGreaterThan(0);
    for (const id of referenced) {
      expect(defined).toContain(id);
      expect(sectionTemplate).toMatch(new RegExp(`const ${id} = '`));
    }
  });

  it('uses no HTML sinks anywhere in the section', () => {
    expect(sectionTemplate).not.toContain('{@html');
    expect(sectionTemplate).not.toContain('set:html');
    expect(sectionTemplate).not.toContain('innerHTML');
    expect(sectionTemplate).not.toContain('dangerouslySetInnerHTML');
  });

  it('links only real on-site routes, relative and path-only', () => {
    expect(NATIVE_LINKS.length).toBeGreaterThan(0);
    for (const link of NATIVE_LINKS) {
      expect(link.href.startsWith('/')).toBe(true);
      expect(link.href).not.toMatch(/^https?:/);
    }
    expect(sectionTemplate).toContain('<a href={link.href}>{link.label}</a>');
  });
});

describe('native evidence: honest copy', () => {
  it.each([
    /coming soon/i,
    /production-ready/i,
    /write once/i,
    /ios (is )?available (today|now)/i,
    /\bship(s|ping)? (in|on) (Q[1-4]|January|February|March|April|May|June|July|August|September|October|November|December|20\d\d)/i,
    // No calendar year anywhere: dates presented as promises are banned.
    /\b20\d\d\b/,
  ])('the copy never matches %s', (banned) => {
    expect(allCopy).not.toMatch(banned);
  });

  it('states the in-development status and the Maven truth explicitly', () => {
    expect(sectionTemplate).toMatch(/in development/);
    expect(sectionTemplate).toMatch(/ADR-005/);
    expect(sectionTemplate).toMatch(/nothing is on Maven Central yet/i);
    expect(NATIVE_PLANNED.some((item) => /Maven Central publication/.test(item))).toBe(true);
  });

  it('cites the real npm preview version exactly as shipped', () => {
    expect(NATIVE_SHIPPED.join('\n')).toContain('0.1.0-next.1');
    expect(NATIVE_SHIPPED.join('\n')).toContain('next dist-tag');
  });

  it('marks the native modules as in this repository, not published artifacts', () => {
    expect(registry).toMatch(/consumed in place/i);
    expect(NATIVE_PLANNED.join('\n')).toMatch(/consumed in place/);
  });
});

describe('native evidence: CSS baseline', () => {
  const styleBlock = sectionTemplate.slice(sectionTemplate.indexOf('<style>'));

  it('uses logical properties only — no physical directional CSS', () => {
    expect(styleBlock).not.toMatch(/(padding|margin)-(left|right):/);
    expect(styleBlock).not.toMatch(/(inset|border)-(left|right):/);
    expect(styleBlock).not.toMatch(/text-align: (left|right)/);
    expect(styleBlock).not.toMatch(/float:/);
    expect(styleBlock).toMatch(/inline-size/);
    expect(styleBlock).toMatch(/padding-block/);
  });

  it('collapses to one column at 360px (22.5rem), matching the site query convention', () => {
    expect(styleBlock).toMatch(/@media \(max-width: 22\.5rem\)/);
  });

  it('themes through --tx-* tokens only, with no raw palette colors', () => {
    const tokens = new Set(styleBlock.match(/--tx-[a-z0-9-]+/g) ?? []);
    expect(tokens.size).toBeGreaterThanOrEqual(5);
    expect(styleBlock).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(styleBlock).not.toMatch(/rgba?\(/);
  });
});
