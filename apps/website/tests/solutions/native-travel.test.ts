import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NATIVE_COMPONENT_SOURCE,
  NATIVE_COMPONENT_TRAVEL,
  NATIVE_PARITY_SOURCE,
  NATIVE_SHARED_SOLUTIONS,
  NATIVE_TRAVEL_STEPS,
} from '../../src/components/sections/native/travel/travel-content.ts';
import { NATIVE_COMPATIBILITY } from '../../src/data/native/compatibility.ts';

const sectionRoot = 'apps/website/src/components/sections/native/travel';
const componentSection = readFileSync(resolve(sectionRoot, 'ComponentsThatTravel.astro'), 'utf8');
const solutionsSection = readFileSync(resolve(sectionRoot, 'ComplexSolutionsTravel.astro'), 'utf8');

describe('Native components and complex solutions travel sections', () => {
  it('lists real catalog components with generated statuses and checked-in traces', () => {
    expect(NATIVE_COMPONENT_TRAVEL.map(({ id }) => id)).toEqual([
      'layout-doc',
      'blocks-text',
      'blocks-data',
    ]);

    for (const item of NATIVE_COMPONENT_TRAVEL) {
      const native = NATIVE_COMPATIBILITY.components.find(({ id }) => id === item.id);
      expect(native).toBeDefined();
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.summary.length).toBeGreaterThan(0);
      expect(item.web).toBe(native?.web);
      expect(item.composeDesktop).toBe(native?.composeDesktop);
      expect(item.conformance).toBe(native?.conformance);
      expect(item.traces).toEqual(native?.evidence.traces);
      expect(item.traces.length).toBeGreaterThan(0);
      for (const path of item.traces) expect(existsSync(resolve(path)), path).toBe(true);
    }
    expect(existsSync(resolve(NATIVE_COMPONENT_SOURCE))).toBe(true);
    expect(existsSync(resolve(NATIVE_PARITY_SOURCE))).toBe(true);
  });

  it('documents catalog-to-web-and-Kotlin flow with real source paths', () => {
    expect(NATIVE_TRAVEL_STEPS.map(({ title }) => title)).toEqual([
      'Catalog',
      '@texuli/spec',
      'Web player',
      'Kotlin twin',
    ]);
    for (const step of NATIVE_TRAVEL_STEPS)
      expect(existsSync(resolve(step.path)), step.path).toBe(true);
    expect(NATIVE_TRAVEL_STEPS[3]?.detail).toContain('visible placeholders');
  });

  it('covers complex solution intents with package README evidence', () => {
    expect(NATIVE_SHARED_SOLUTIONS.map(({ title }) => title)).toEqual([
      'Presentations',
      'Documents',
      'Workflows',
      'Canvas',
      'Sheets',
    ]);
    for (const solution of NATIVE_SHARED_SOLUTIONS) {
      expect(solution.sharedIntent.length).toBeGreaterThan(0);
      expect(solution.package).toMatch(/^@texuli\//);
      expect(existsSync(resolve(solution.path)), solution.path).toBe(true);
    }
    expect(solutionsSection).toContain('does not certify these complete solution editors');
  });

  it('keeps both sections static, accessible, sink-free, and linked to evidence', () => {
    for (const source of [componentSection, solutionsSection]) {
      expect(source).toContain('<section');
      expect(source).toContain('aria-labelledby=');
      expect(source).toContain('<h2');
      expect(source).toContain('safeHref(');
      expect(source).not.toMatch(/client:(?:load|idle|visible|media|only)/);
      expect(source).not.toMatch(/set:html|\{@html|innerHTML|<script/);
    }
    expect(componentSection).toContain('data-tx-native-travel=');
    expect(componentSection).toContain('component.traces');
    expect(componentSection).toContain('{component.web}');
    expect(componentSection).toContain('{component.composeDesktop}');
    expect(solutionsSection).toContain('data-tx-native-solutions-travel=');
    expect(solutionsSection).toContain('{solution.sharedIntent}');
  });
});
