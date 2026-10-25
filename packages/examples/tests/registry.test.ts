import type { Component } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetExamplesForTests,
  defineExample,
  getExample,
  listExampleIds,
  listExamples,
} from '../src/registry.ts';
import type { ExampleEntry } from '../src/types.ts';

const stubComponent = (() => ({})) as unknown as Component;

const stubLoad: ExampleEntry['load'] = async () => ({ default: stubComponent });

function sample(overrides: Partial<ExampleEntry> = {}): ExampleEntry {
  return {
    id: 'demo-button',
    title: 'Primary button',
    description: 'A fictional primary button on example.com copy.',
    tags: ['button', 'texuli'],
    component: 'texuli/Button',
    props: ['variant', 'disabled'],
    load: stubLoad,
    ...overrides,
  };
}

afterEach(() => {
  __resetExamplesForTests();
});

describe('defineExample', () => {
  it('registers metadata and returns a frozen entry', () => {
    const entry = defineExample(sample());
    expect(entry.id).toBe('demo-button');
    expect(Object.isFrozen(entry)).toBe(true);
    expect(getExample('demo-button')).toBe(entry);
    expect(listExampleIds()).toEqual(['demo-button']);
  });

  it('rejects a duplicate id', () => {
    defineExample(sample());
    expect(() => defineExample(sample())).toThrow(/already registered/);
  });

  it('rejects invalid ids, empty titles and bad component paths', () => {
    expect(() => defineExample(sample({ id: 'Bad_Id' }))).toThrow(/kebab-case/);
    expect(() => defineExample(sample({ id: 'ok', title: '  ' }))).toThrow(/title/);
    expect(() => defineExample(sample({ id: 'ok', component: 'Button' }))).toThrow(
      /package\/Export/
    );
    expect(() => defineExample(sample({ id: 'ok', tags: ['dup', 'dup'] }))).toThrow(/unique/);
    expect(() =>
      defineExample({
        id: 'ok',
        title: 'T',
        description: 'D',
        tags: [],
        component: 'core/safeHref',
        load: undefined as unknown as ExampleEntry['load'],
      })
    ).toThrow(/load/);
  });
});

describe('listExamples', () => {
  it('sorts by id and filters by tag and component', () => {
    defineExample(sample({ id: 'zeta', tags: ['a'], component: 'texuli/Button' }));
    defineExample(
      sample({
        id: 'alpha',
        tags: ['a', 'core'],
        component: 'core/safeHref',
        props: undefined,
      })
    );

    expect(listExampleIds()).toEqual(['alpha', 'zeta']);
    expect(listExamples({ tag: 'core' }).map((e) => e.id)).toEqual(['alpha']);
    expect(listExamples({ component: 'texuli' }).map((e) => e.id)).toEqual(['zeta']);
    expect(listExamples({ component: 'core/safeHref' }).map((e) => e.id)).toEqual(['alpha']);
  });
});

describe('public barrel', () => {
  it('loads the seed example and its Svelte module', async () => {
    vi.resetModules();
    const mod = await import('../src/index.ts');
    const ids = mod.listExampleIds();
    expect(ids).toContain('core-safe-href');

    const entry = mod.getExample('core-safe-href');
    expect(entry?.component).toBe('core/safeHref');
    expect(entry?.tags).toEqual(expect.arrayContaining(['core', 'url']));

    const loaded = await entry!.load();
    expect(loaded.default).toBeTypeOf('function');
  });
});
