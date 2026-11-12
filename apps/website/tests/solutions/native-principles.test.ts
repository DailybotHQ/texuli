import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_URL } from '../../src/components/foundation/site.ts';
import {
  NATIVE_PRINCIPLES,
  nativePrinciplesView,
} from '../../src/components/sections/native/principles/principles-content.ts';
import { NATIVE_COMPATIBILITY } from '../../src/data/native/compatibility.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const COMPONENT = readFileSync(
  resolve(WEBSITE, 'src/components/sections/native/principles/NativePrinciples.astro'),
  'utf8'
);
const view = nativePrinciplesView();
const parity = JSON.parse(readFileSync(resolve(REPO, 'native/docs/parity.json'), 'utf8')) as {
  specVersion: string;
  totals: { catalog: number; painted: number };
};

describe('Native principles, agents and start building', () => {
  it('states the three section titles and treats native feel as principles, not shipped features', () => {
    expect(NATIVE_PRINCIPLES.principles.title).toBe('Native should feel native.');
    expect(NATIVE_PRINCIPLES.agents.title).toBe('Built for humans and agents, on every target.');
    expect(NATIVE_PRINCIPLES.start.title).toBe('Start building.');
    expect(NATIVE_PRINCIPLES.principles.lede).toMatch(/principles, not a checklist/);
    expect(NATIVE_PRINCIPLES.principles.items.map((item) => item.id)).toEqual([
      'input',
      'navigation',
      'assistive',
    ]);
    const copy = JSON.stringify({ copy: NATIVE_PRINCIPLES, view });
    expect(copy).not.toMatch(/production[- ]ready|write once|run anywhere|coming soon/i);
    expect(copy).not.toMatch(/PLAN_|haptics are (ready|available)/i);
  });

  it('takes spec version and paint counts from the compatibility data', () => {
    expect(NATIVE_COMPATIBILITY.specVersion).toBe(parity.specVersion);
    expect(view.spec).toBe(parity.specVersion);
    // Spec 0.15.0: view.spec tracks the regenerated parity matrix.
    expect(view.spec).toBe('0.15.0');
    expect(view.painted).toBe(parity.totals.painted);
    expect(view.catalog).toBe(parity.totals.catalog);
    const slice = `${parity.totals.painted} of ${parity.totals.catalog}`;
    expect(view.steps.find((step) => step.id === 'resolve')?.body).toContain(slice);
    expect(view.steps.find((step) => step.id === 'resolve')?.body).toMatch(/read-only/);
    expect(view.platforms.map((row) => row.id)).toEqual([
      'web',
      'compose-desktop',
      'android',
      'ios',
    ]);
  });

  it('names real agent surfaces and shows the native agents and start plates', () => {
    expect(view.surfaces.map((s) => s.label)).toEqual([
      '@texuli/spec',
      'validateDraft',
      'blueprint.validate',
    ]);
    expect(view.steps.find((step) => step.id === 'validate')?.body).toContain('validateDraft');
    expect(view.steps.find((step) => step.id === 'validate')?.body).toContain('blueprint.validate');
    expect(NATIVE_PRINCIPLES.art).toBe('native-agents');
    expect(NATIVE_PRINCIPLES.startArt).toBe('native-start');
    expect(COMPONENT).toContain('<SiteIllustration art={copy.art} />');
    expect(COMPONENT).toContain('<SiteIllustration art={copy.startArt} />');
    for (const slot of [NATIVE_PRINCIPLES.art, NATIVE_PRINCIPLES.startArt])
      expect(existsSync(resolve(WEBSITE, `src/assets/illustrations/${slot}.webp`)), slot).toBe(
        true
      );
  });

  it('points start-building actions at real pages or the native directory', () => {
    expect(view.actions.map((a) => a.role)).toEqual(['primary', 'secondary', 'text']);
    for (const action of view.actions) {
      if (action.href.startsWith(REPOSITORY_URL)) {
        expect(action.href).toBe(`${REPOSITORY_URL}/tree/main/native`);
        expect(existsSync(resolve(REPO, 'native/README.md'))).toBe(true);
        continue;
      }
      const [path, hash] = action.href.split('#');
      expect(path).not.toMatch(/-page\//);
      const page = resolve(
        WEBSITE,
        'src/pages',
        (path ?? '').replace(/^\/+|\/+$/g, ''),
        'index.astro'
      );
      expect(existsSync(page), action.href).toBe(true);
      if (hash) expect(readFileSync(page, 'utf8')).toContain(`id="${hash}"`);
    }
  });

  it('is static, with three labelled sections and no HTML sink', () => {
    expect(COMPONENT).not.toMatch(/client:|set:html|\{@html|innerHTML|<script/);
    expect(COMPONENT).toContain('aria-labelledby={copy.ids.principles}');
    expect(COMPONENT).toContain('aria-labelledby={copy.ids.agents}');
    expect(COMPONENT).toContain('aria-labelledby={copy.ids.start}');
    expect(COMPONENT).toContain("safeHref(href, 'developer')");
    expect(COMPONENT).not.toMatch(
      /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/
    );
  });
});
