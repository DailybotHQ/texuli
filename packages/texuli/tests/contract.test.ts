/// <reference types="node" />
/// <reference types="vite/client" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import {
  type ContractCase,
  checkContract,
  exportedComponents,
} from '../../primitives/tests/support/contract.ts';
import { createContractRefs } from '../../primitives/tests/support/contract-refs.svelte.ts';
import { CASES, EXCLUDED, EXCLUDED_PREFIXES } from './contract/cases.ts';
import FieldRuleContract from './contract/FieldRuleContract.svelte';

// One API contract over every exported styled component (docs/STANDARDS.md,
// "Component API contract"): rest attributes and `bind:ref` on the root
// element (the focusable control for split form controls), caller handlers
// composed with the component's own behavior.

const components = import.meta.glob<{ default: unknown }>('../src/**/*.svelte', { eager: true });
const entryModules = import.meta.glob<Record<string, unknown>>('../src/**/*.ts', { eager: true });

const sources = new Map<unknown, string>();
for (const [path, module] of Object.entries(components)) {
  sources.set(module.default, path.replace('../src/', '').replace(/\.svelte$/, ''));
}

/** The modules behind package.json `exports` (TypeScript entries and direct `.svelte` ones). */
function exportEntries(): Record<string, unknown>[] {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), 'packages/texuli/package.json'), 'utf8')
  ) as { exports: Record<string, string | { default?: string; svelte?: string }> };
  const entries: Record<string, unknown>[] = [];
  for (const target of Object.values(manifest.exports)) {
    const file = typeof target === 'string' ? target : (target.svelte ?? target.default ?? '');
    const local = file.replace('./src/', '../src/');
    if (file.endsWith('.svelte')) entries.push({ default: components[local]?.default });
    else if (file.endsWith('.ts')) {
      const module = entryModules[local];
      if (!module) throw new Error(`export ${file} did not load`);
      entries.push(module);
    }
  }
  return entries;
}

const exported = exportedComponents(exportEntries(), sources);
const KEYS = CASES.map((c) => c.key);
const byKey = new Map<string, ContractCase>(CASES.map((c) => [c.key, c]));
const prefixed = (key: string) =>
  Object.keys(EXCLUDED_PREFIXES).some((prefix) => key.startsWith(prefix));

describe('component API contract', () => {
  it('covers every exported component (a case or a documented exclusion)', () => {
    expect(exported.size).toBeGreaterThan(150);
    const missing = [...exported.keys()].filter(
      (key) => !byKey.has(key) && !(key in EXCLUDED) && !prefixed(key)
    );
    expect(missing).toEqual([]);
    const stale = [...byKey.keys(), ...Object.keys(EXCLUDED)].filter((key) => !exported.has(key));
    expect(stale).toEqual([]);
  });

  const observed: string[] = [];
  for (const c of CASES) {
    it(`${c.key}: rest attributes, bind:ref and composed handlers`, async () => {
      const result = await checkContract(c, () => createContractRefs(KEYS));
      observed.push(...result.observed.map((event) => `${c.key}:${event}`));
      expect(result.failures).toEqual([]);
    });
  }

  it('observes the own behavior of the interactive components (the composition checks bite)', () => {
    expect(observed.length).toBeGreaterThan(0);
  });
});

/**
 * The Field rule: `id`, `aria-describedby`, `aria-invalid` (and `disabled`)
 * that a Field hands its control (`{...control.props}`) reach the focusable
 * control, so `<label for>` focuses it and its description and error are
 * announced. Group controls with no labelable element (a radio group, a
 * rating) take the id on the group and are named by the Field label.
 */
const FORM_CONTROLS = [
  'Input',
  'Textarea',
  'TextCounter',
  'InputGroup',
  'Checkbox',
  'Switch',
  'Slider',
  'TagsInput',
  'FileUpload',
  'DatePicker',
  'DateRangePicker',
  'TimeField',
  'NumberField',
  'PinInput',
  'Select',
  'Combobox',
] as const;
const GROUP_CONTROLS = ['RadioGroup', 'Rating', 'ColorPicker'] as const;
const FOCUSABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']);

describe('Field rule: id and aria from a Field reach the focusable control', () => {
  for (const control of FORM_CONTROLS) {
    it(`${control}: the label targets the control, which is described and invalid`, async () => {
      render(FieldRuleContract, { props: { control } });
      await tick();
      const target = document.getElementById('field-ctl');
      expect(target, 'an element takes the Field id').not.toBeNull();
      const element = target as HTMLElement;
      const focusable =
        FOCUSABLE.has(element.tagName) ||
        element.tabIndex >= 0 ||
        ['slider', 'combobox', 'spinbutton', 'switch', 'checkbox'].includes(
          element.getAttribute('role') ?? ''
        );
      expect(focusable, `<${element.tagName.toLowerCase()}> takes the id`).toBe(true);
      const describedBy = element.getAttribute('aria-describedby') ?? '';
      expect(describedBy).toContain('field-ctl-description');
      expect(describedBy).toContain('field-ctl-error');
      expect(element.getAttribute('aria-invalid')).toBe('true');
      // One visible label: the Field's.
      expect(document.querySelectorAll('.tx-date__label')).toHaveLength(0);
    });
  }
  for (const control of GROUP_CONTROLS) {
    it(`${control}: the group takes the id and is described and invalid`, async () => {
      render(FieldRuleContract, { props: { control } });
      await tick();
      const element = document.getElementById('field-ctl') as HTMLElement | null;
      expect(element, 'an element takes the Field id').not.toBeNull();
      const described =
        element?.closest('[aria-describedby]') ?? element?.querySelector('[aria-describedby]');
      expect(described?.getAttribute('aria-describedby') ?? '').toContain('field-ctl-error');
    });
  }
});
