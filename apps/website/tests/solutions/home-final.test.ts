import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { safeHref } from '@texuli/core/url-policy';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { illustrationFor } from '../../src/components/landing/illustrations.ts';
import {
  FINAL_22_COPY,
  FINAL_22_PATHS,
  finalPaths,
} from '../../src/components/sections/home/final-22/final-content.ts';
import { wordCount } from '../../src/components/sections/home/home-content.ts';
import { PROTOYARD } from '../../src/data/products/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const DIR = resolve(WEBSITE, 'src/components/sections/home/final-22');
const component = readFileSync(resolve(DIR, 'HomeFinal22.astro'), 'utf8');
const content = readFileSync(resolve(DIR, 'final-content.ts'), 'utf8');
const markup = component.slice(component.lastIndexOf('---') + 3, component.indexOf('<style>'));
const styles = component.slice(component.indexOf('<style>'));
const path = (id: string) => FINAL_22_PATHS.find((p) => p.id === id);

describe('home final band content', () => {
  it('uses the storyboard title, a short sub and the home-final band art with its dark file', () => {
    expect(FINAL_22_COPY.title).toBe('Build your next interface.');
    expect(wordCount(FINAL_22_COPY.sub)).toBeLessThanOrEqual(25);
    const art = illustrationFor(FINAL_22_COPY.art);
    expect(art?.variant).toBe('band');
    expect(art?.fileDark).toBe('home-final-dark.webp');
  });

  it('offers exactly two paths: integrate a Solution, prototype with Protoyard', () => {
    expect(FINAL_22_PATHS.map((p) => p.title)).toEqual([
      'Integrate a Solution',
      'Prototype with Protoyard',
    ]);
    for (const p of FINAL_22_PATHS) expect(wordCount(p.body), p.id).toBeLessThanOrEqual(30);
  });

  it('links /solutions/ and the getting-started guide for integration, both real routes', () => {
    expect(path('integrate')?.links.map((l) => l.href)).toEqual([
      '/solutions/',
      '/guides/getting-started/',
    ]);
    for (const link of path('integrate')?.links ?? [])
      expect(siteRouteExists(link.href), link.href).toBe(true);
  });

  it('links the Protoyard case study and protoyard.app, with the local version status from the record', () => {
    const prototype = path('prototype');
    expect(prototype?.links.map((l) => l.href)).toEqual([
      '/built-with/protoyard/',
      'https://protoyard.app',
    ]);
    expect(siteRouteExists('/built-with/protoyard/')).toBe(true);
    expect(safeHref('https://protoyard.app', 'developer')).toBe('https://protoyard.app');
    expect(prototype?.links[1]?.external).toBe(true);
    const local = PROTOYARD.offerings.find((o) => o.id === 'open-source-local');
    expect(prototype?.status).toEqual({ label: local?.label, status: local?.status });
  });

  it('never offers Protoyard Cloud, a hosted service or the plan in its copy', () => {
    const copy = JSON.stringify([FINAL_22_COPY, FINAL_22_PATHS]);
    expect(copy).not.toMatch(/cloud|hosted|multiplayer|PLAN_|Ronin/i);
  });

  it('drops internal links whose page does not exist, keeping the external site', () => {
    const none = finalPaths(() => false);
    expect(none.find((p) => p.id === 'integrate')?.links).toEqual([]);
    expect(none.find((p) => p.id === 'prototype')?.links.map((l) => l.href)).toEqual([
      'https://protoyard.app',
    ]);
    for (const p of finalPaths())
      for (const link of p.links) if (!link.external) expect(siteRouteExists(link.href)).toBe(true);
    expect(content).not.toMatch(/import\.meta\.dirname|readFileSync|node:fs/);
  });
});

describe('home final band markup', () => {
  it('is a labelled section with one h2, an h3 per path, the badge and the art', () => {
    expect(markup).toContain('aria-labelledby={copy.id}');
    expect((markup.match(/<h2\b/g) ?? []).length).toBe(1);
    expect((markup.match(/<h3\b/g) ?? []).length).toBe(1);
    expect(markup).not.toMatch(/<h1\b/);
    expect(markup).toContain(
      '<StatusBadge status={path.status.status} context={path.status.label} />'
    );
    expect(markup).toContain('<SiteIllustration art={copy.art} />');
  });

  it('is static and safe: no island, no second copy command, URL-policy links, logical CSS', () => {
    expect(markup).not.toMatch(/client:[a-z]+/);
    expect(component).not.toMatch(/<script\b|set:html|\{@html|innerHTML|CopyCommand/);
    expect(markup).not.toMatch(/\sstyle=/);
    expect(component).toContain("safeHref(href, 'developer')");
    expect(markup).toContain('href={resolveHref(link.href, link.external)}');
    expect(markup).toContain("rel={link.external ? 'noopener' : undefined}");
    expect(styles).not.toMatch(
      /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/
    );
  });
});
