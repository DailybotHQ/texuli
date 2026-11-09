import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import {
  NATIVE_LLMS_ROUTES,
  nativeLlmsSection,
  siteLlmsSections,
} from '../../src/components/seo/llms-site.ts';
import { LISTED_PRODUCTS } from '../../src/data/products/index.ts';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';
import { productRoute, registryLlmsSections } from '../../src/lib/twins/solutions.ts';

const SITE = 'https://texuli.com';
const LLMS = readFileSync(resolve(import.meta.dirname, '../../public/llms.txt'), 'utf8');

function section(name: string) {
  const found = siteLlmsSections(SITE).find((entry) => entry.name === name);
  if (!found) throw new Error(`llms.txt has no "${name}" section`);
  return found;
}

function heading(name: string): string {
  return `## ${name}`;
}

describe('llms.txt Solutions, Native and Built with', () => {
  it('omits Native until a page exists, then lists only existing routes', () => {
    expect(nativeLlmsSection(SITE, () => false)).toBeUndefined();
    const onlyLanding = nativeLlmsSection(SITE, (route) => route === '/native/');
    expect(onlyLanding?.links.map((link) => link.href)).toEqual([`${SITE}/native/`]);
    expect(onlyLanding?.links.some((link) => link.href.includes('/native/compatibility/'))).toBe(
      false
    );
    const both = nativeLlmsSection(SITE, () => true);
    expect(both?.links.map((link) => link.href)).toEqual(
      NATIVE_LLMS_ROUTES.map((entry) => `${SITE}${entry.route}`)
    );
  });

  it('matches the registry for Solutions and Built with, and existing Native routes', () => {
    const fromRegistry = registryLlmsSections(SITE);
    expect(section('Solutions')).toEqual(fromRegistry.find((entry) => entry.name === 'Solutions'));
    expect(section('Built with Texuli')).toEqual(
      fromRegistry.find((entry) => entry.name === 'Built with Texuli')
    );

    const solutionsHrefs = section('Solutions').links.map((link) => link.href);
    expect(solutionsHrefs).toContain(`${SITE}/solutions/`);
    expect(solutionsHrefs).toContain(`${SITE}/solutions/index.json`);
    for (const entry of SOLUTIONS) {
      if (siteRouteExists(entry.route)) expect(solutionsHrefs).toContain(`${SITE}${entry.route}`);
      else expect(solutionsHrefs).not.toContain(`${SITE}${entry.route}`);
      if (siteRouteExists(entry.docs)) expect(solutionsHrefs).toContain(`${SITE}${entry.docs}`);
      else expect(solutionsHrefs).not.toContain(`${SITE}${entry.docs}`);
    }

    const productHrefs = section('Built with Texuli').links.map((link) => link.href);
    if (siteRouteExists('/built-with/')) expect(productHrefs).toContain(`${SITE}/built-with/`);
    for (const product of LISTED_PRODUCTS) {
      const href = `${SITE}${productRoute(product)}`;
      if (siteRouteExists(productRoute(product))) expect(productHrefs).toContain(href);
      else expect(productHrefs).not.toContain(href);
    }

    const native = nativeLlmsSection(SITE);
    expect(native, '/native/ exists so the Native section ships').toBeDefined();
    const nativeHrefs = native?.links.map((link) => link.href) ?? [];
    for (const entry of NATIVE_LLMS_ROUTES) {
      if (siteRouteExists(entry.route)) expect(nativeHrefs).toContain(`${SITE}${entry.route}`);
      else expect(nativeHrefs).not.toContain(`${SITE}${entry.route}`);
    }
    expect(nativeHrefs).toContain(`${SITE}/native/`);
  });

  it('never links a route that does not exist, and never names the plan', () => {
    for (const name of ['Solutions', 'Built with Texuli', 'Native'] as const) {
      const found = siteLlmsSections(SITE).find((entry) => entry.name === name);
      expect(found, name).toBeDefined();
      for (const link of found?.links ?? []) {
        const route = link.href.slice(SITE.length);
        if (route === '/solutions/index.json') expect(siteRouteExists('/solutions/')).toBe(true);
        else expect(siteRouteExists(route), route).toBe(true);
      }
    }
    const copy = JSON.stringify([
      section('Solutions'),
      section('Built with Texuli'),
      nativeLlmsSection(SITE),
    ]);
    expect(copy).not.toMatch(/PLAN_\d+|T-agents|T-f-/);
  });

  it('is the committed public/llms.txt, generated rather than hand-edited', () => {
    for (const name of ['Solutions', 'Built with Texuli', 'Native']) {
      expect(LLMS).toContain(heading(name));
    }
    for (const link of [
      ...section('Solutions').links,
      ...section('Built with Texuli').links,
      ...(nativeLlmsSection(SITE)?.links ?? []),
    ]) {
      expect(LLMS).toContain(`](${link.href})`);
    }
    expect(LLMS).toContain('https://texuli.com/native/');
    if (!siteRouteExists('/native/compatibility/')) {
      expect(LLMS).not.toContain('https://texuli.com/native/compatibility/');
    }
  });
});
