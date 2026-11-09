import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { MOTION_SECTIONS } from '../../src/components/motion-site/page.ts';

const PAGE = readFileSync(resolve('apps/website/src/pages/motion-page/index.astro'), 'utf8');
const COPY = PAGE.replace(/\s+/g, ' ');
const HREFS = [...PAGE.matchAll(/href="([^"]+)"/g)].map((match) => match[1] ?? '');

describe('Motion capability page', () => {
  it('keeps the canonical route and classifies the runtime as a capability', () => {
    expect(PAGE).toContain('/motion-page/');
    expect(PAGE).toContain('class="taxonomy">Capability');
    expect(COPY).toContain('an embeddable animation runtime, not a hosted motion product');
    expect(COPY).toContain('prefers-reduced-motion');
    expect(PAGE).toContain('MotionConsole');
    expect(PAGE).not.toContain('/capabilities/motion/');
    expect(PAGE).not.toContain('PLAN_');
    expect(PAGE).not.toMatch(/href=["']\/solutions\//);
  });

  it('keeps the reduced-motion control and every demo section', () => {
    expect(PAGE).toContain('id="settings"');
    expect(MOTION_SECTIONS[0]?.id).toBe('settings');
    expect(MOTION_SECTIONS[0]?.title).toMatch(/reduced motion/i);
    expect(PAGE).toContain('client:visible');
    const islands = [...PAGE.matchAll(/<([A-Z]\w+) client:(\w+)/g)];
    expect(islands.length).toBeGreaterThan(0);
    for (const [, name, directive] of islands) expect(`${name} ${directive}`).toMatch(/ visible$/);
  });

  it('links only existing routes and never the *-page a landing will replace', () => {
    expect(PAGE).toContain("href: '/drag-page/'");
    expect(PAGE).toContain("href: '/forms-page/'");
    expect(PAGE).toContain("href: '/guides/accessibility/'");
    expect(PAGE).toContain('href={item.href}');
    expect(siteRouteExists('/drag-page/')).toBe(true);
    expect(siteRouteExists('/forms-page/')).toBe(true);
    expect(siteRouteExists('/guides/accessibility/')).toBe(true);
    expect(PAGE).not.toMatch(/href=["']\/(slides|documents|workflows|canvas|sheets)-page\//);
    expect(PAGE).toContain("'/slides-page/'");
    expect(PAGE).toContain('REPLACED_DEMOS');
    for (const href of HREFS) {
      if (href.startsWith('#') || href.startsWith('https:')) continue;
      expect(siteRouteExists(href), href).toBe(true);
    }
  });

  it('keeps the page sink-free', () => {
    expect(PAGE).not.toMatch(/\{@html|set:html|innerHTML|srcdoc/);
  });
});
