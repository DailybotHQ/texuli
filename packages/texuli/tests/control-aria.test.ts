/// <reference types="node" />
import { createRequire } from 'node:module';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Fixture from './fixtures/ControlAriaFixture.svelte';

/*
 * FIX-choice-aria: accessibility attributes passed to a styled form component
 * reach its CONTROL, so an unlabeled control is named by aria-label (WCAG
 * 4.1.2) and described by aria-describedby. Wrapper hooks (class, style)
 * stay on the wrapper.
 */
afterEach(() => cleanup());

const CASES: { which: string; role: string }[] = [
  { which: 'checkbox', role: 'checkbox' },
  { which: 'switch', role: 'switch' },
  { which: 'radio-group', role: 'radiogroup' },
  { which: 'radio', role: 'radio' },
  { which: 'input', role: 'textbox' },
  { which: 'textarea', role: 'textbox' },
  { which: 'select-trigger', role: 'combobox' },
  { which: 'combobox-input', role: 'combobox' },
  { which: 'slider', role: 'slider' },
  { which: 'number-field', role: 'spinbutton' },
  { which: 'pin-input', role: 'textbox' },
  { which: 'tags-input', role: 'textbox' },
  { which: 'toggle', role: 'button' },
  { which: 'toggle-group-item', role: 'button' },
  { which: 'rating', role: 'radiogroup' },
];

describe('aria-* passed to a styled form component lands on its control', () => {
  for (const { which, role } of CASES) {
    it(`${which}: ${role} named by aria-label and described by aria-describedby`, () => {
      render(Fixture, { props: { which } });
      const control = screen.getByRole(role, { name: 'Probe label' });
      expect(control.getAttribute('aria-describedby') ?? '').toContain('probe-desc');
    });
  }

  it('file-upload: the file input is named by aria-label', () => {
    render(Fixture, { props: { which: 'file-upload' } });
    const input = screen.getByLabelText('Probe label');
    expect(input.getAttribute('type')).toBe('file');
  });

  it('a labeled checkbox keeps its visible name and also takes aria-describedby', () => {
    render(Fixture, { props: { which: 'checkbox-labeled' } });
    const control = screen.getByRole('checkbox', { name: 'Visible' });
    expect(control.getAttribute('aria-describedby') ?? '').toContain('probe-desc');
    expect(control.getAttribute('data-probe')).toBe('control');
  });
});

// axe-core comes with the root's @axe-core/playwright; resolve it from there.
const req = createRequire(import.meta.url);
type AxeResult = { violations: { id: string; nodes: { target: string[] }[] }[] };
const axe = req(createRequire(req.resolve('@axe-core/playwright')).resolve('axe-core')) as {
  run(context: Element, options: unknown): Promise<AxeResult>;
};

describe('axe: unlabeled controls named by aria-label', () => {
  // Name and ARIA rules only: happy-dom has no layout, so contrast and
  // target-size belong to the browser sweeps.
  const RULES = [
    'button-name',
    'label',
    'aria-input-field-name',
    'aria-toggle-field-name',
    'aria-allowed-attr',
    'aria-valid-attr',
    'aria-valid-attr-value',
    'aria-required-attr',
  ];
  for (const { which } of [...CASES, { which: 'file-upload' }]) {
    it(`${which} has no name or ARIA violations`, async () => {
      const { container } = render(Fixture, { props: { which } });
      const result = await axe.run(container, { runOnly: { type: 'rule', values: RULES } });
      expect(
        result.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`
        )
      ).toEqual([]);
    });
  }
});
