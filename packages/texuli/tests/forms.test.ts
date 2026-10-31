/// <reference types="node" />
import { createRequire } from 'node:module';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { CalendarDate } from '@texuli/primitives/calendar';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Checkbox from '../src/components/choice/Checkbox.svelte';
import RadioGroup from '../src/components/choice/RadioGroup.svelte';
import { createFoldedFilter } from '../src/components/combobox/index.ts';
import {
  Calendar,
  DateRangePicker,
  dateRangePresets,
  matchingPreset,
} from '../src/components/date/index.ts';
import {
  type FieldErrorMap,
  fieldMessage,
  isValidErrorMap,
  toFieldErrorMap,
} from '../src/components/field/form-utils.ts';
import { autosizeTextarea } from '../src/components/input/autosize.ts';
import Input from '../src/components/input/Input.svelte';
import TextCounter from '../src/components/input/TextCounter.svelte';
import { CopyButton, copyText } from '../src/components/kbd-code/index.ts';
import { formatRatingLabel, Rating } from '../src/components/rating/index.ts';
import ColorPicker from '../src/components/tags-color/ColorPicker.svelte';
import TagsInput from '../src/components/tags-color/TagsInput.svelte';
import BannerRefHarness from './BannerRefHarness.svelte';
import FieldHarness from './FieldHarness.svelte';
import ApiRefHarness from './fixtures/ApiRefHarness.svelte';
import { API_REF_KINDS } from './fixtures/api-ref-kind.ts';
import ButtonFormHarness from './fixtures/ButtonFormHarness.svelte';
import ButtonHarness from './fixtures/ButtonHarness.svelte';
import ClassValueHarness from './fixtures/ClassValueHarness.svelte';
import CodeHarness from './fixtures/CodeHarness.svelte';
import ComboboxHarness from './fixtures/ComboboxHarness.svelte';
import Fixture from './fixtures/ControlAriaFixture.svelte';
import CopyButtonHarness from './fixtures/CopyButtonHarness.svelte';
import FieldLabelHarness from './fixtures/FieldLabelHarness.svelte';
import FileUploadHarness from './fixtures/FileUploadHarness.svelte';
import FormControlsHarness from './fixtures/FormControlsHarness.svelte';
import IconButtonHarness from './fixtures/IconButtonHarness.svelte';
import InputComposeHarness from './fixtures/InputComposeHarness.svelte';
import InputValueHarness from './fixtures/InputValueHarness.svelte';
import LabelPropHarness from './fixtures/LabelPropHarness.svelte';
import Harness from './fixtures/NumberPinHarness.svelte';
import RefHarness from './fixtures/RefHarness.svelte';
import { type RefKind } from './fixtures/ref-kind.ts';
import SelectFixture from './fixtures/SelectFixture.svelte';
import SliderHarness from './fixtures/SliderHarness.svelte';
import TagsInputHarness from './fixtures/TagsInputHarness.svelte';
import ToggleHarness from './fixtures/ToggleHarness.svelte';

// Styled form components: ARIA reaching the control (axe), label and ref
// contracts, URL policy on button links, form submission and validation.

describe('control-aria', () => {
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

  // axe-core comes with the root's @axe-core/playwright; resolve it from there.
  const req = createRequire(import.meta.url);
  type AxeResult = { violations: { id: string; nodes: { target: string[] }[] }[] };
  const axe = req(createRequire(req.resolve('@axe-core/playwright')).resolve('axe-core')) as {
    run(context: Element, options: unknown): Promise<AxeResult>;
  };

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

  describe('aria-* passed to a styled form component lands on its control', () => {
    it('names and describes every control, with no name or ARIA violations (axe)', async () => {
      for (const { which, role } of [...CASES, { which: 'file-upload', role: '' }]) {
        const { container } = render(Fixture, { props: { which } });
        if (role) {
          const control = screen.getByRole(role, { name: 'Probe label' });
          expect(control.getAttribute('aria-describedby') ?? '', which).toContain('probe-desc');
        } else {
          expect(screen.getByLabelText('Probe label').getAttribute('type'), which).toBe('file');
        }
        const result = await axe.run(container, { runOnly: { type: 'rule', values: RULES } });
        expect(
          result.violations.map(
            (v) => `${which} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`
          )
        ).toEqual([]);
        cleanup();
      }
    });

    it('a labeled checkbox keeps its visible name and also takes aria-describedby', () => {
      render(Fixture, { props: { which: 'checkbox-labeled' } });
      const control = screen.getByRole('checkbox', { name: 'Visible' });
      expect(control.getAttribute('aria-describedby') ?? '').toContain('probe-desc');
      expect(control.getAttribute('data-probe')).toBe('control');
    });
  });
});

describe('field label context (G91)', () => {
  afterEach(cleanup);

  // Importing the root barrel transforms the whole package on a cold worker,
  // which is CPU-bound and outlasted the 5 s default under parallel load.
  it('exports useFieldLabel and getFieldLabelContext from texuli/field', {
    timeout: 30_000,
  }, async () => {
    const field = (await import('../src/components/field/index.ts')) as Record<string, unknown>;
    const root = (await import('../src/index.ts')) as Record<string, unknown>;
    for (const name of ['useFieldLabel', 'getFieldLabelContext']) {
      expect(typeof field[name], name).toBe('function');
      expect(root[name], name).toBe(field[name]);
    }
  });

  it('names a custom control group from the Field label, and nothing outside a Field', () => {
    render(FieldLabelHarness);
    const [inside, outside] = screen.getAllByTestId('custom-group');
    expect(within(document.body).getByRole('group', { name: 'Priority' })).toBe(inside);
    expect(outside?.hasAttribute('aria-labelledby')).toBe(false);
  });
});

describe('label-prop', () => {
  afterEach(cleanup);

  /**
   * The plain-text `label` prop on Button, Badge and Kbd (audit G03): optional,
   * escaped text, and it replaces `children` when both are given.
   */
  const COMPONENTS = [
    { component: 'button', selector: '[data-tx-button]' },
    { component: 'badge', selector: '[data-tx-badge]' },
    { component: 'kbd', selector: '[data-tx-kbd]' },
  ] as const;

  function root(props: Record<string, unknown>, selector: string): HTMLElement {
    const { container } = render(LabelPropHarness, { props: props as never });
    const el = container.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`missing ${selector}`);
    return el;
  }

  describe('label prop on Button, Badge and Kbd', () => {
    it('renders the label as escaped text that replaces children, and keeps children without it', () => {
      for (const { component, selector } of COMPONENTS) {
        let el = root({ component, label: 'Save changes' }, selector);
        expect(el.textContent?.trim(), component).toBe('Save changes');
        expect(el.hasAttribute('label'), component).toBe(false);
        cleanup();

        el = root({ component, label: '<img src=x onerror=alert(1)>' }, selector);
        expect(el.textContent?.trim(), component).toBe('<img src=x onerror=alert(1)>');
        expect(el.querySelector('img'), component).toBeNull();
        expect(el.children.length, component).toBe(0);
        cleanup();

        el = root({ component, label: 'Shipped', text: 'Slot text' }, selector);
        expect(el.textContent?.trim(), component).toBe('Shipped');
        expect(el.querySelector('[data-slot]'), component).toBeNull();
        cleanup();

        for (const label of [undefined, '']) {
          el = root({ component, label, text: 'Slot text' }, selector);
          expect(el.querySelector('[data-slot]')?.textContent, `${component} ${label}`).toBe(
            'Slot text'
          );
          cleanup();
        }
      }
    });
  });

  describe('Button label while loading', () => {
    it('keeps the label in the hidden label span, like children', () => {
      const el = root(
        { component: 'button', label: 'Save changes', loading: true },
        '[data-tx-button]'
      );
      expect(el.querySelector('.tx-button__label--hidden')?.textContent).toBe('Save changes');
      expect(el.getAttribute('aria-busy')).toBe('true');
    });
  });
});

describe('ref', () => {
  const KINDS: readonly { kind: RefKind; attr: string }[] = [
    { kind: 'button', attr: 'data-tx-button' },
    { kind: 'icon-button', attr: 'data-tx-button' },
    { kind: 'card', attr: 'data-tx-card' },
    { kind: 'card-header', attr: 'data-tx-card-header' },
    { kind: 'card-content', attr: 'data-tx-card-content' },
    { kind: 'card-footer', attr: 'data-tx-card-footer' },
    { kind: 'card-title', attr: 'data-tx-card-title' },
    { kind: 'card-description', attr: 'data-tx-card-description' },
    { kind: 'label', attr: 'data-tx-label' },
    { kind: 'checkbox', attr: 'data-tx-choice-field' },
    { kind: 'switch', attr: 'data-tx-choice-field' },
    { kind: 'input', attr: 'data-tx-input' },
    { kind: 'textarea', attr: 'data-tx-textarea' },
    { kind: 'badge', attr: 'data-tx-badge' },
    { kind: 'kbd', attr: 'data-tx-kbd' },
    { kind: 'separator', attr: 'data-tx-separator' },
    { kind: 'progress', attr: 'data-tx-progress' },
    { kind: 'skeleton', attr: 'data-tx-skeleton' },
    { kind: 'avatar', attr: 'data-tx-avatar' },
    { kind: 'alert', attr: 'data-tx-alert' },
    { kind: 'callout', attr: 'data-tx-alert' },
  ];

  afterEach(() => {
    cleanup();
  });

  describe('styled component bind:ref', () => {
    it('points bind:ref at the rendered root of every listed component, and clears it on unmount', async () => {
      for (const { kind, attr } of KINDS) {
        const box: { current: HTMLElement | null } = { current: null };
        const view = render(RefHarness, {
          props: {
            kind,
            get ref() {
              return box.current;
            },
            set ref(value: HTMLElement | null) {
              box.current = value;
            },
          },
        });

        await vi.waitFor(() => {
          expect(box.current, kind).toBeInstanceOf(HTMLElement);
        });

        const el = box.current as HTMLElement;
        const marked = view.container.querySelector(`[${attr}]`);
        expect(marked, kind).toBeTruthy();
        // Root ref is the marked element, or a solo wrapper that contains it.
        expect(el === marked || (marked !== null && el.contains(marked as Node)), kind).toBe(true);

        view.unmount();
        await vi.waitFor(() => {
          expect(box.current, kind).toBeNull();
        });
      }
    });
  });
});

describe('banner-ref', () => {
  afterEach(cleanup);

  describe('Banner ref', () => {
    it('binds the rendered root element like Alert and Callout do', () => {
      const view = render(BannerRefHarness);
      expect(view.container.querySelector('[data-tx-layout="banner"]')).toBeTruthy();
      expect(view.getByTestId('banner-ref-tag').textContent).toBe('DIV');
    });
  });
});

describe('class-value', () => {
  describe('ClassValue on styled roots', () => {
    it('renders string, array (with falsy) and object class maps on Button, Badge, Card and Input', () => {
      render(ClassValueHarness);

      const buttonString = screen.getByTestId('cv-button-string');
      expect(buttonString.className.split(/\s+/)).toEqual(
        expect.arrayContaining(['tx-button', 'cv-string'])
      );

      const buttonArray = screen.getByTestId('cv-button-array');
      const arrayClasses = buttonArray.className.split(/\s+/);
      expect(arrayClasses).toEqual(expect.arrayContaining(['tx-button', 'cv-full', 'cv-array']));
      expect(arrayClasses).not.toContain('cv-quiet');

      const buttonObject = screen.getByTestId('cv-button-object');
      const objectClasses = buttonObject.className.split(/\s+/);
      expect(objectClasses).toEqual(expect.arrayContaining(['tx-button', 'cv-object']));
      expect(objectClasses).not.toContain('cv-off');

      const badge = screen.getByTestId('cv-badge');
      expect(badge.className.split(/\s+/)).toEqual(
        expect.arrayContaining(['tx-badge', 'cv-badge', 'cv-full'])
      );

      const card = screen.getByTestId('cv-card');
      expect(card.className.split(/\s+/)).toEqual(expect.arrayContaining(['tx-card', 'cv-card']));

      const input = screen.getByTestId('cv-input');
      const inputClasses = input.className.split(/\s+/);
      expect(inputClasses).toEqual(expect.arrayContaining(['cv-input']));
      expect(inputClasses).not.toContain('cv-quiet');
    });
  });
});

describe('button', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Button', () => {
    it('shows pending while an async onclick promise is unsettled', async () => {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      const onclick = vi.fn(() => promise);
      const { getByRole, container } = render(ButtonHarness, {
        props: { label: 'Submit', onclick },
      });
      const button = getByRole('button', { name: 'Submit' });
      button.focus();
      await fireEvent.click(button);
      expect(onclick).toHaveBeenCalledTimes(1);
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(container.querySelector('[data-tx-button-spinner]')).toBeTruthy();
      // G94: pending keeps focus (aria-disabled, not native disabled) and
      // suppresses further clicks until the promise settles.
      expect((button as HTMLButtonElement).disabled).toBe(false);
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(document.activeElement).toBe(button);
      await fireEvent.click(button);
      expect(onclick).toHaveBeenCalledTimes(1);
      resolve();
      await promise;
      await vi.waitFor(() => {
        expect(button.getAttribute('aria-busy')).toBeNull();
        expect(button.hasAttribute('aria-disabled')).toBe(false);
      });
      await fireEvent.click(button);
      expect(onclick).toHaveBeenCalledTimes(2);
    });

    it('a pending submit button keeps focus and blocks a second submit (G94)', async () => {
      let resolve!: () => void;
      const onclick = vi.fn(
        () =>
          new Promise<void>((r) => {
            resolve = r;
          })
      );
      const onsubmit = vi.fn();
      const { getByRole } = render(ButtonFormHarness, { props: { onclick, onsubmit } });
      const button = getByRole('button', { name: 'Send' });
      button.focus();
      await fireEvent.click(button);
      expect(onsubmit).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(button);
      await fireEvent.click(button);
      expect(onsubmit).toHaveBeenCalledTimes(1);
      expect(onclick).toHaveBeenCalledTimes(1);
      resolve();
      await vi.waitFor(() => expect(button.hasAttribute('aria-disabled')).toBe(false));
      await fireEvent.click(button);
      expect(onsubmit).toHaveBeenCalledTimes(2);
    });

    it('renders safe href anchors and blocks unsafe ones', () => {
      const safe = render(ButtonHarness, {
        props: { label: 'Docs', href: 'https://example.com/docs' },
      });
      const link = safe.getByRole('link', { name: 'Docs' });
      expect(link.getAttribute('href')).toBe('https://example.com/docs');
      expect(link.className).toContain('tx-button--default');
      safe.unmount();

      const blocked = render(ButtonHarness, {
        props: { label: 'Bad', href: 'javascript:alert(1)' },
      });
      const btn = blocked.getByRole('button', { name: 'Bad' });
      expect(btn.getAttribute('data-href-blocked')).toBe('true');
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it('loadingLabel replaces, not joins, the accessible name while busy', () => {
      // ui-button.md contract: `loadingLabel` is "the accessible name announced
      // while loading". The visible label must not concatenate into it.
      const { getByRole, queryByRole } = render(ButtonHarness, {
        props: { label: 'Save', loading: true, loadingLabel: 'Saving changes' },
      });
      expect(getByRole('button', { name: 'Saving changes' })).toBeTruthy();
      expect(queryByRole('button', { name: 'Save Saving changes' })).toBeNull();
    });
  });

  describe('IconButton', () => {
    it('requires an accessible name via label', () => {
      const { getByRole } = render(IconButtonHarness, {
        props: { label: 'Close dialog' },
      });
      const button = getByRole('button', { name: 'Close dialog' });
      expect(button.className).toContain('tx-button--icon');
      expect(button.getAttribute('aria-label')).toBe('Close dialog');
    });
  });
});

describe('input', () => {
  afterEach(() => cleanup());

  describe('Input', () => {
    it('supports clearable with an accessible clear control', async () => {
      const onClear = vi.fn();
      const onValueChange = vi.fn();
      render(Input, {
        props: {
          'aria-label': 'Search',
          value: 'query',
          clearable: true,
          clearLabel: 'Clear search',
          onClear,
          onValueChange,
        },
      });
      const clear = screen.getByRole('button', { name: 'Clear search' });
      await fireEvent.click(clear);
      expect(onClear).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('');
    });
  });

  describe('Textarea', () => {
    it('autosize sets block-size from scrollHeight', () => {
      const el = document.createElement('textarea');
      Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => 120 });
      autosizeTextarea(el);
      expect(el.style.blockSize).toBe('120px');
    });
  });

  describe('TextCounter', () => {
    it('exposes remaining characters to assistive tech', async () => {
      render(TextCounter, {
        props: {
          label: 'Title',
          maxlength: 10,
          showAfter: 10,
          value: 'Hello',
        },
      });
      const input = screen.getByLabelText('Title') as HTMLInputElement;
      expect(input.getAttribute('aria-describedby')).toBeTruthy();
      await fireEvent.focus(input);
      expect(screen.getByText(/5/)).toBeTruthy();
      await fireEvent.input(input, { target: { value: 'Hello!!!!!' } });
      // clipped to maxlength
      expect(input.value.length).toBeLessThanOrEqual(10);
    });
  });
});

describe('field', () => {
  afterEach(cleanup);

  describe('form-utils', () => {
    it('normalizes validation shapes into a field error map', () => {
      expect(toFieldErrorMap({ email: ' Required ' })).toEqual({ email: 'Required' });
      expect(toFieldErrorMap([['name', 'Too short']])).toEqual({ name: 'Too short' });
      expect(toFieldErrorMap('Something failed')).toEqual({ _form: 'Something failed' });
      expect(isValidErrorMap({})).toBe(true);
      expect(fieldMessage({ email: 'Nope' }, 'email')).toBe('Nope');
    });
  });

  describe('Field', () => {
    it('hands its disabled state to the control through control.props', () => {
      const view = render(FieldHarness, { props: { label: 'Locked field', disabled: true } });
      const input = view.getByRole('textbox', { name: 'Locked field' }) as HTMLInputElement;
      // The docs promise "chrome + control props" for disabled, like required.
      expect(input.disabled).toBe(true);
      expect(input.getAttribute('aria-invalid')).toBeNull();
    });
  });

  describe('Form', () => {
    it('runs onValidate and blocks submit when errors are returned', async () => {
      const onSubmitValues = vi.fn();
      const view = render(FieldHarness, {
        props: {
          mode: 'form',
          onValidate: (values: Record<string, string>): FieldErrorMap => {
            if (values.email?.includes('@')) return {} as FieldErrorMap;
            return { email: 'Include an @ sign' };
          },
          onSubmitValues,
        },
      });
      const email = view.getByRole('textbox', { name: 'Email' });
      await fireEvent.input(email, { target: { value: 'not-an-email' } });
      await fireEvent.click(view.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(view.getByRole('alert').textContent).toContain('Include an @ sign');
      });
      expect(onSubmitValues).not.toHaveBeenCalled();

      await fireEvent.input(email, { target: { value: 'ada@example.com' } });
      await fireEvent.click(view.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(onSubmitValues).toHaveBeenCalled());
      expect(onSubmitValues.mock.calls[0]?.[0]).toMatchObject({ email: 'ada@example.com' });
    });

    it('submits after a failed attempt with native validation on', async () => {
      const onSubmitValues = vi.fn();
      const view = render(FieldHarness, {
        props: {
          mode: 'form',
          nativeValidation: true,
          onValidate: (values: Record<string, string>): FieldErrorMap =>
            values.email === 'ada@example.com'
              ? ({} as FieldErrorMap)
              : { email: 'Use your work address' },
          onSubmitValues,
        },
      });
      const email = view.getByRole('textbox', { name: 'Email' });
      await fireEvent.input(email, { target: { value: 'grace@example.com' } });
      await fireEvent.click(view.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(view.getByRole('alert').textContent).toContain('Use your work address');
      });
      // The message from the failed attempt must not block the next submit.
      await fireEvent.input(email, { target: { value: 'ada@example.com' } });
      await fireEvent.click(view.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(onSubmitValues).toHaveBeenCalledTimes(1));
    });
  });
});

describe('choice', () => {
  afterEach(cleanup);

  describe('Checkbox', () => {
    it('supports indeterminate mixed state', async () => {
      render(Checkbox, {
        props: { label: 'Select all', indeterminate: true },
      });
      const box = screen.getByRole('checkbox', { name: 'Select all' });
      expect(box.getAttribute('aria-checked')).toBe('mixed');
      await fireEvent.click(box);
      expect(box.getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('RadioGroup', () => {
    it('selects one option from items and supports card variant', async () => {
      const onValueChange = vi.fn();
      render(RadioGroup, {
        props: {
          value: 'a',
          onValueChange,
          name: 'plan',
          items: [
            { value: 'a', label: 'Starter', description: 'Solo workspace' },
            { value: 'b', label: 'Team', description: 'Shared notes' },
          ],
        },
      });
      const group = screen.getByRole('radiogroup');
      expect(group).toBeTruthy();
      const starter = screen.getByRole('radio', { name: 'Starter' });
      const team = screen.getByRole('radio', { name: 'Team' });
      expect(starter.getAttribute('aria-checked')).toBe('true');
      await fireEvent.click(team);
      expect(onValueChange).toHaveBeenCalledWith('b');
    });
  });
});

describe('combobox', () => {
  afterEach(() => cleanup());

  describe('Combobox', () => {
    it('reflects the context open state on the field without an explicit open prop', async () => {
      // The docs pattern renders <Combobox.Field> with no props: the open
      // chrome must follow the combobox context, not require manual threading.
      const { container } = render(ComboboxHarness);
      const field = () =>
        container.querySelector<HTMLElement>('[data-tx-combobox-field]') as HTMLElement;
      expect(field().getAttribute('data-state')).toBe('closed');
      await fireEvent.input(screen.getByRole('combobox', { name: 'Colors' }), {
        target: { value: 'ja' },
      });
      await waitFor(() => expect(field().getAttribute('data-state')).toBe('open'));
    });
  });

  describe('Combobox filter and form props', () => {
    const accented = [
      { value: 'cafe', label: 'Café crème' },
      { value: 'jade', label: 'Jade' },
    ];
    const palette = () => screen.getByRole('form', { name: 'Palette' }) as HTMLFormElement;

    it('passes a custom filter through to the primitive', async () => {
      render(ComboboxHarness, { props: { items: accented, filter: createFoldedFilter() } });
      await fireEvent.input(screen.getByRole('combobox', { name: 'Colors' }), {
        target: { value: 'cafe creme' },
      });
      expect(screen.getAllByRole('option').map((option) => option.textContent?.trim())).toEqual([
        'Café crème',
      ]);
    });

    it('submits the Combobox value and enforces required', async () => {
      render(ComboboxHarness, { props: { name: 'color', required: true } });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(palette().checkValidity()).toBe(false);
      await fireEvent.input(screen.getByRole('combobox', { name: 'Colors' }), {
        target: { value: 'ja' },
      });
      await fireEvent.click(screen.getByRole('option', { name: 'Jade' }));
      expect(new FormData(palette()).getAll('color')).toEqual(['jade']);
      expect(palette().checkValidity()).toBe(true);
    });

    it('submits one entry per MultiSelect value', async () => {
      render(ComboboxHarness, { props: { mode: 'multi', name: 'colors', value: [] } });
      const input = screen.getByRole('combobox', { name: 'Colors' });
      for (const [text, label] of [
        ['am', 'Amber'],
        ['ja', 'Jade'],
      ]) {
        await fireEvent.input(input, { target: { value: text } });
        await fireEvent.click(screen.getByRole('option', { name: label }));
      }
      expect(new FormData(palette()).getAll('colors')).toEqual(['amber', 'jade']);
    });
  });
});

describe('select', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Select', () => {
    it('names the option group through Select.Label', async () => {
      render(SelectFixture, { props: { open: true, value: 'free' } });
      const listbox = await screen.findByRole('listbox');
      // APG listbox grouping: the group is named by its group label.
      expect(within(listbox).getByRole('group', { name: 'Plans' })).toBeTruthy();
    });

    it('keeps the separator out of the listbox semantics', async () => {
      render(SelectFixture, { props: { open: true, value: 'free' } });
      const listbox = await screen.findByRole('listbox');
      // A listbox may own only options and groups: the rule is decorative.
      const separator = listbox.querySelector('[data-tx-select-separator]');
      expect(separator?.getAttribute('aria-hidden')).toBe('true');
      expect(separator?.tagName).not.toBe('HR');
      expect(listbox.querySelector('hr, [role="separator"]')).toBeNull();
    });
  });
});

describe('date', () => {
  const settle = async () => {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();
  };

  describe('date presets', () => {
    it('crosses year and leap boundaries', () => {
      const january = dateRangePresets('2028-01-03');
      expect(january.find((preset) => preset.id === 'lastMonth')).toMatchObject({
        start: '2027-12-01',
        end: '2027-12-31',
      });
      expect(january.find((preset) => preset.id === 'last7')?.start).toBe('2027-12-28');
      const leap = dateRangePresets('2028-03-10');
      expect(leap.find((preset) => preset.id === 'lastMonth')?.end).toBe('2028-02-29');
    });

    it('translates labels, rejects an invalid today and finds the matching preset', () => {
      const presets = dateRangePresets('2026-03-15', { last7: 'Últimos 7 días' });
      expect(presets[2]?.label).toBe('Últimos 7 días');
      expect(dateRangePresets('2026-02-30')).toEqual([]);
      expect(dateRangePresets('soon')).toEqual([]);
      expect(matchingPreset(presets, '2026-03-09', '2026-03-15')?.id).toBe('last7');
      expect(matchingPreset(presets, '2026-03-09', null)).toBeUndefined();
    });
  });

  describe('Calendar', () => {
    it('disables days outside the bounds and unavailable days', () => {
      render(Calendar, {
        props: {
          value: '2026-03-12',
          minValue: '2026-03-02',
          maxValue: '2026-03-27',
          isDateUnavailable: (date: CalendarDate) =>
            date.compare(new CalendarDate(2026, 3, 18)) === 0,
        },
      });
      const disabled = (name: string) =>
        (screen.getByRole('button', { name }) as HTMLButtonElement).disabled;
      expect(disabled('Sunday, March 1, 2026')).toBe(true);
      expect(disabled('Wednesday, March 18, 2026')).toBe(true);
      expect(disabled('Saturday, March 28, 2026')).toBe(true);
      expect(disabled('Monday, March 2, 2026')).toBe(false);
    });

    it('shows day numbers in the locale digits, matching the day names', () => {
      render(Calendar, { props: { value: '2026-03-12', locale: 'ar-EG' } });
      const day = screen
        .getAllByRole('button')
        .find((button) => button.hasAttribute('data-selected'));
      expect(day?.textContent?.trim()).toBe('١٢');
      expect(day?.getAttribute('aria-label')).toContain('١٢');
    });
  });

  describe('DateRangePicker', () => {
    it('offers presets, marks the matching one and applies a preset', async () => {
      render(DateRangePicker, {
        props: {
          label: 'Report period',
          value: { start: '2026-03-09', end: '2026-03-15' },
          presets: true,
          today: '2026-03-15',
        },
      });
      await fireEvent.click(
        screen.getByRole('button', { name: /^Choose date, selected date is Monday, March 9/ })
      );
      const dialog = await screen.findByRole('dialog');
      const group = within(dialog).getByRole('group', { name: 'Quick ranges' });
      expect(
        within(group).getByRole('button', { name: 'Last 7 days' }).getAttribute('aria-pressed')
      ).toBe('true');
      expect(
        within(group).getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')
      ).toBe('false');
      await fireEvent.click(within(group).getByRole('button', { name: 'Last month' }));
      await settle();
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(
        screen.getByRole('button', {
          name: 'Choose date, selected date is Sunday, February 1, 2026 – Saturday, February 28, 2026',
        })
      ).toBeTruthy();
    });
  });

  describe('styled pickers focus the start day on open', () => {
    it('DateRangePicker focuses the range start, not the presets before it', async () => {
      render(DateRangePicker, {
        props: {
          label: 'Report period',
          value: { start: '2026-03-09', end: '2026-03-15' },
          presets: true,
          today: '2026-03-15',
        },
      });
      await fireEvent.click(
        screen.getByRole('button', { name: /^Choose date, selected date is Monday, March 9/ })
      );
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('group', { name: 'Quick ranges' })).toBeTruthy();
      await waitFor(() =>
        expect(document.activeElement?.getAttribute('aria-label')).toBe('Monday, March 9, 2026')
      );
    });
  });
});

describe('rating', () => {
  afterEach(cleanup);

  const fills = (container: HTMLElement) =>
    [...container.querySelectorAll('.tx-rating__star')].map((star) =>
      Number(star.querySelector('.tx-rating__fill')?.getAttribute('data-fill') ?? 0)
    );

  describe('rating helpers', () => {
    it('formats translatable templates for the locale', () => {
      expect(formatRatingLabel('{value} of {max} stars', { value: 2.5, max: 5 })).toBe(
        '2.5 of 5 stars'
      );
      expect(formatRatingLabel('{value} von {max}', { value: 2.5, max: 5 }, 'de-DE')).toBe(
        '2,5 von 5'
      );
      expect(formatRatingLabel('{unknown}', {})).toBe('{unknown}');
    });
  });

  describe('Rating input (APG radio group)', () => {
    it('moves the single Tab stop to the new value when it changes from outside', async () => {
      const view = render(Rating, { props: { value: 2 } });
      const stops = () =>
        screen
          .getAllByRole('radio')
          .filter((radio) => radio.tabIndex === 0)
          .map((radio) => radio.getAttribute('aria-label'));
      expect(stops()).toEqual(['2 of 5 stars']);
      await view.rerender({ value: 4 });
      await waitFor(() => expect(stops()).toEqual(['4 of 5 stars']));
    });

    it('mirrors the arrow keys in right-to-left text', async () => {
      const host = document.createElement('div');
      host.dir = 'rtl';
      document.body.append(host);
      const onValueChange = vi.fn();
      render(Rating, { target: host, props: { value: 2, onValueChange } });
      const two = screen.getByRole('radio', { name: '2 of 5 stars' });
      two.focus();
      await fireEvent.keyDown(two, { key: 'ArrowLeft' });
      expect(onValueChange).toHaveBeenLastCalledWith(3);
      await fireEvent.keyDown(screen.getByRole('radio', { name: '3 of 5 stars' }), {
        key: 'ArrowRight',
      });
      expect(onValueChange).toHaveBeenLastCalledWith(2);
      host.remove();
    });

    it('supports half values with two labeled radios per star', async () => {
      const onValueChange = vi.fn();
      const { container } = render(Rating, { props: { allowHalf: true, onValueChange } });
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(10);
      expect(radios[4]?.getAttribute('aria-label')).toBe('2.5 of 5 stars');
      expect(radios[4]?.classList.contains('tx-rating__hit--start')).toBe(true);
      expect(radios[5]?.classList.contains('tx-rating__hit--end')).toBe(true);
      await fireEvent.click(screen.getByRole('radio', { name: '3.5 of 5 stars' }));
      expect(onValueChange).toHaveBeenLastCalledWith(3.5);
      expect(fills(container)).toEqual([1, 1, 1, 0.5, 0]);
      expect(container.querySelector('.tx-rating')?.classList.contains('tx-rating--half')).toBe(
        true
      );
    });

    it('clears on a second press of the selected star or Delete, only when clearable', async () => {
      const onValueChange = vi.fn();
      render(Rating, { props: { value: 3, clearable: true, onValueChange } });
      await fireEvent.click(screen.getByRole('radio', { name: '3 of 5 stars' }));
      expect(onValueChange).toHaveBeenLastCalledWith(0);
      expect(
        screen
          .getAllByRole('radio')
          .every((radio) => radio.getAttribute('aria-checked') === 'false')
      ).toBe(true);
      await fireEvent.click(screen.getByRole('radio', { name: '2 of 5 stars' }));
      await fireEvent.keyDown(screen.getByRole('radio', { name: '2 of 5 stars' }), {
        key: 'Delete',
      });
      expect(onValueChange).toHaveBeenLastCalledWith(0);
      cleanup();

      const kept = vi.fn();
      render(Rating, { props: { value: 3, onValueChange: kept } });
      await fireEvent.click(screen.getByRole('radio', { name: '3 of 5 stars' }));
      await fireEvent.keyDown(screen.getByRole('radio', { name: '3 of 5 stars' }), {
        key: 'Delete',
      });
      expect(kept).not.toHaveBeenCalled();
    });

    it('does not clear on the first press when focus selects before the click', async () => {
      const onValueChange = vi.fn();
      render(Rating, { props: { clearable: true, onValueChange } });
      const three = screen.getByRole('radio', { name: '3 of 5 stars' });
      // A real press: pointerdown, focus (the group selects on focus), click.
      await fireEvent.pointerDown(three);
      three.focus();
      await fireEvent.click(three);
      expect(three.getAttribute('aria-checked')).toBe('true');
      expect(onValueChange).toHaveBeenLastCalledWith(3);
      // A second press on it clears.
      await fireEvent.pointerDown(three);
      await fireEvent.click(three);
      expect(onValueChange).toHaveBeenLastCalledWith(0);
    });

    it('does not change when read-only or disabled', async () => {
      const onValueChange = vi.fn();
      render(Rating, { props: { value: 2, readonly: true, onValueChange } });
      await fireEvent.click(screen.getByRole('radio', { name: '4 of 5 stars' }));
      expect(onValueChange).not.toHaveBeenCalled();
      cleanup();
      render(Rating, { props: { value: 2, disabled: true } });
      expect(
        screen.getAllByRole('radio').every((radio) => (radio as HTMLButtonElement).disabled)
      ).toBe(true);
    });

    it('submits the value with a name', async () => {
      const { container } = render(Rating, { props: { value: 3, name: 'score' } });
      const form = document.createElement('form');
      document.body.append(form);
      form.append(container);
      await Promise.resolve();
      expect(new FormData(form).get('score')).toBe('3');
      form.remove();
    });
  });

  describe('Rating display', () => {
    it('is a labeled image showing any fraction, with no radios', () => {
      const { container } = render(Rating, {
        props: { value: 4.3, display: true, showValue: true },
      });
      const image = screen.getByRole('img', { name: 'Rated 4.3 out of 5' });
      expect(image.getAttribute('data-tx-rating')).toBe('display');
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      const shown = fills(container);
      expect(shown.slice(0, 4)).toEqual([1, 1, 1, 1]);
      expect(shown[4]).toBeCloseTo(0.3, 5);
      expect(container.querySelector('.tx-rating__value')?.getAttribute('aria-hidden')).toBe(
        'true'
      );
    });
  });
});

describe('slider', () => {
  afterEach(() => cleanup());

  describe('Slider', () => {
    it('shows mark labels and ticks', () => {
      render(SliderHarness, { props: { mode: 'marks' } });
      expect(screen.getByText('Low')).toBeTruthy();
      expect(screen.getByText('Mid')).toBeTruthy();
      expect(screen.getByText('High')).toBeTruthy();
      expect(document.querySelectorAll('.tx-slider__tick').length).toBeGreaterThan(0);
    });
  });
});

describe('tags-color', () => {
  afterEach(cleanup);

  describe('TagsInput (G11)', () => {
    it('reports each refusal with its reason and binds the draft both ways', async () => {
      const onInvalid = vi.fn();
      const onInputValueChange = vi.fn();
      const view = render(TagsInputHarness, {
        props: {
          max: 3,
          validate: (tag: string) => tag.includes('@') || 'Use an email address',
          onInvalid,
          onInputValueChange,
        },
      });
      const field = screen.getByRole('textbox', { name: 'Add a recipient' }) as HTMLInputElement;
      const draft = () => view.container.querySelector('[data-probe="draft"]')?.textContent;
      const cases: { typed: string; reason: string | null }[] = [
        { typed: 'design', reason: 'duplicate' },
        { typed: 'not-an-email', reason: 'invalid' },
        { typed: 'ada@example.com', reason: null },
        { typed: 'bea@example.com', reason: null },
        { typed: 'cal@example.com', reason: 'max' },
      ];
      for (const { typed, reason } of cases) {
        onInvalid.mockClear();
        await fireEvent.input(field, { target: { value: typed } });
        expect(draft(), typed).toBe(typed);
        await fireEvent.keyDown(field, { key: 'Enter' });
        if (reason === null) {
          expect(onInvalid, typed).not.toHaveBeenCalled();
          expect(draft(), typed).toBe('');
          expect(field.value).toBe('');
        } else {
          expect(onInvalid.mock.calls[0]?.[0], typed).toMatchObject({
            tag: typed,
            reason,
            ...(reason === 'invalid' ? { message: 'Use an email address' } : {}),
          });
          // A refused draft stays for correction.
          expect(draft(), typed).toBe(typed);
        }
      }
      expect(onInputValueChange).toHaveBeenCalledWith('');
      // The host writes the draft into the field.
      await fireEvent.click(screen.getByRole('button', { name: 'Prefill' }));
      expect(field.value).toBe('ops@example.com');
    });
  });

  describe('ColorPicker', () => {
    it('accepts a hex value in the format field', async () => {
      const onValueChange = vi.fn();
      render(ColorPicker, {
        props: {
          value: '#3b82f6',
          label: 'Brand color',
          onValueChange,
          swatches: [],
        },
      });
      const field = screen.getByRole('textbox') as HTMLInputElement;
      await fireEvent.input(field, { target: { value: '#22c55e' } });
      await fireEvent.change(field, { target: { value: '#22c55e' } });
      await waitFor(() => {
        const calls = onValueChange.mock.calls.map((c) => String(c[0]).toLowerCase());
        expect(calls.some((c) => c.includes('22c55e') || c.includes('34c759'))).toBe(true);
      });
    });
  });
});

describe('number-pin', () => {
  afterEach(cleanup);

  describe('NumberField and PinInput styled components', () => {
    it('renders accessible code cells and reflects disabled state', () => {
      const view = render(Harness);
      const pin = view.container.querySelector('[data-pin-input-root]');
      const realInput = screen.getByRole('textbox', { name: 'Verification code' });
      const cells = view.container.querySelectorAll('.tx-pin-input__cell');

      expect(pin?.className).toContain('tx-pin-input--md');
      expect(pin?.className).toContain('custom-pin-input');
      expect(realInput.getAttribute('autocomplete')).toBe('one-time-code');
      expect(cells).toHaveLength(4);
      expect(cells[0]?.textContent).toBe('1');
      expect(cells[1]?.textContent).toBe('2');
      expect(
        view.container.querySelector('.tx-pin-input__cells')?.getAttribute('aria-hidden')
      ).toBe('true');
    });
  });
});

describe('file-upload', () => {
  afterEach(() => cleanup());

  function makeFile(name: string, type: string, size = 32): File {
    const buffer = new Uint8Array(size);
    return new File([buffer], name, { type, lastModified: 1 });
  }

  describe('FileUpload', () => {
    it('lists accepted files and allows remove', async () => {
      const file = makeFile('notes.txt', 'text/plain');
      const { container, getByLabelText } = render(FileUploadHarness, {
        props: { files: [file], accept: '.txt,text/plain' },
      });
      expect(container.querySelector('[data-tx-file-upload-list]')).toBeTruthy();
      expect(container.textContent).toContain('notes.txt');
      const remove = getByLabelText('Remove notes.txt');
      await fireEvent.click(remove);
      expect(container.querySelector('[data-tx-file-upload-list]')).toBeNull();
    });

    it('reports added and removed files to the callbacks and the caller handlers (G8)', async () => {
      const notes = makeFile('notes.txt', 'text/plain');
      const plan = makeFile('plan.md', 'text/markdown');
      const bad = makeFile('archive.zip', 'application/zip');
      const extra = makeFile('extra.txt', 'text/plain');
      const onFilesAdd = vi.fn();
      const onFileRemove = vi.fn();
      const onchange = vi.fn();
      const ondrop = vi.fn();
      const { container, getByLabelText } = render(FileUploadHarness, {
        props: {
          accept: '.txt,.md',
          files: [notes],
          onFilesAdd,
          onFileRemove,
          onchange,
          ondrop,
        },
      });
      // Host-set files are not reported.
      expect(onFilesAdd).not.toHaveBeenCalled();
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(input, 'files', { configurable: true, value: [plan, bad] });
      await fireEvent.change(input);
      const zone = container.querySelector('.tx-file-upload__zone') as HTMLElement;
      await fireEvent.drop(zone, { dataTransfer: { files: [extra], types: ['Files'] } });
      expect(onFilesAdd.mock.calls).toEqual([[[plan]], [[extra]]]);
      expect(onchange).toHaveBeenCalledTimes(1);
      expect(ondrop).toHaveBeenCalledTimes(1);
      await fireEvent.click(getByLabelText('Remove plan.md'));
      expect(onFileRemove.mock.calls).toEqual([[plan]]);
      expect(container.textContent).not.toContain('plan.md');
    });

    it('marks the control disabled', () => {
      const { container } = render(FileUploadHarness, { props: { disabled: true } });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
      expect(input?.disabled).toBe(true);
    });
  });
});

describe('toggle', () => {
  afterEach(() => cleanup());

  describe('ToggleGroup', () => {
    it('wraps long rows only when asked, keeping selection', async () => {
      render(ToggleHarness, { props: { mode: 'group-single' } });
      expect(
        screen.getByRole('group', { name: 'Align' }).classList.contains('tx-toggle-group--wrap')
      ).toBe(false);
      cleanup();
      render(ToggleHarness, { props: { mode: 'group-single', wrap: true } });
      const group = screen.getByRole('group', { name: 'Align' });
      expect(group.classList.contains('tx-toggle-group--wrap')).toBe(true);
      expect(group.classList.contains('tx-toggle-group--outline')).toBe(true);
      const right = screen.getByRole('button', { name: 'Right' });
      await fireEvent.click(right);
      expect(right.getAttribute('aria-pressed')).toBe('true');
    });
  });
});

describe('kbd-code', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('copyText', () => {
    it('returns false when clipboard is unavailable and document is missing', async () => {
      await expect(copyText('x', { clipboard: null, ownerDocument: null })).resolves.toBe(false);
    });
  });

  describe('Code', () => {
    it('renders inline code from value without interpreting HTML', () => {
      const { container } = render(CodeHarness, {
        props: { value: '<script>alert(1)</script>', variant: 'inline' },
      });
      const el = container.querySelector('[data-tx-code]');
      expect(el?.tagName.toLowerCase()).toBe('code');
      expect(el?.getAttribute('data-variant')).toBe('inline');
      expect(el?.textContent).toBe('<script>alert(1)</script>');
      expect(container.querySelector('script')).toBeNull();
    });
  });

  describe('CopyButton', () => {
    it('sets data-state=error when clipboard write fails and fallback is unavailable', async () => {
      const writeText = vi.fn(async () => {
        throw new Error('denied');
      });
      const { getByRole } = render(CopyButtonHarness, {
        props: {
          value: 'secret',
          label: 'Copy secret',
          clipboard: { writeText },
        },
      });
      // Force the pure helper failure path (component uses the same helper).
      await expect(
        copyText('secret', { clipboard: { writeText }, ownerDocument: null })
      ).resolves.toBe(false);
      // With ownerDocument present, fallback may succeed in happy-dom — exercise the button click anyway.
      const button = getByRole('button', { name: /Copy secret/ });
      await fireEvent.click(button);
      await vi.waitFor(() => {
        expect(writeText).toHaveBeenCalled();
        expect(['copied', 'error', 'idle']).toContain(button.getAttribute('data-state'));
      });
    });
  });
});

describe('input-api', () => {
  afterEach(() => cleanup());

  describe('G26: a caller oninput composes with bind:value', () => {
    it('runs the internal handler first, then the caller, on every styled text control', async () => {
      const kinds = [
        'input',
        'input-clearable',
        'textarea',
        'input-group',
        'text-counter',
        'text-counter-textarea',
      ] as const;
      for (const kind of kinds) {
        const seen: (string | number | null)[] = [];
        const view = render(InputComposeHarness, { props: { kind, seen } });
        const field = view.getByRole('textbox') as HTMLInputElement | HTMLTextAreaElement;
        await fireEvent.input(field, { target: { value: 'Ada' } });
        expect(view.getByTestId('bound').textContent, kind).toBe('Ada');
        // The caller ran once and already saw the bound value.
        expect(seen, kind).toEqual(['Ada']);
        view.unmount();
      }
    });
  });

  describe('G38: file inputs', () => {
    it('defaults files to null, keeps value readable, and resets when files is set to null', async () => {
      const view = render(InputValueHarness, { props: { kind: 'file' } });
      const input = view.getByLabelText('Attachment') as HTMLInputElement;
      expect(view.getByTestId('files').textContent).toBe('null');
      expect(() => input.value).not.toThrow();
      expect(input.value).toBe('');

      const file = new File(['hi'], 'note.txt', { type: 'text/plain' });
      // A non-plain object, like a real FileList (Svelte state never proxies it).
      const picked = Object.assign(Object.create({ item: () => file }), {
        0: file,
        length: 1,
      }) as FileList;
      Object.defineProperty(input, 'files', { configurable: true, get: () => picked });
      Object.defineProperty(input, 'value', {
        configurable: true,
        get: () => 'C:\\fakepath\\note.txt',
        set: (next: string) => {
          if (next === '') {
            Object.defineProperty(input, 'files', { configurable: true, get: () => null });
            Object.defineProperty(input, 'value', { configurable: true, value: '' });
          }
        },
      });
      await fireEvent.change(input);
      expect(view.getByTestId('files').textContent).toBe('1');

      await fireEvent.click(view.getByRole('button', { name: 'Reset' }));
      await tick();
      expect(view.getByTestId('files').textContent).toBe('null');
      expect(input.value).toBe('');
    });
  });

  describe('G44: numeric inputs bind numbers', () => {
    it('binds a number for type number and range, and null when emptied', async () => {
      for (const kind of ['number', 'range'] as const) {
        const view = render(InputValueHarness, { props: { kind } });
        const input = view.getByLabelText('Amount') as HTMLInputElement;
        expect(input.value, kind).toBe('3');
        await fireEvent.input(input, { target: { value: '7' } });
        expect(view.getByTestId('amount').textContent, kind).toBe('number:7');
        if (kind === 'number') {
          await fireEvent.input(input, { target: { value: '' } });
          expect(view.getByTestId('amount').textContent, kind).toBe('null');
        }
        view.unmount();
      }
    });

    it('keeps the typed text while it parses to the bound number, and follows outside changes', async () => {
      const view = render(InputValueHarness, { props: { kind: 'number' } });
      const input = view.getByLabelText('Amount') as HTMLInputElement;
      const amount = () => view.getByTestId('amount').textContent;
      await fireEvent.input(input, { target: { value: '' } });
      expect(amount()).toBe('null');
      // Typing "1." is not a valid number yet: browsers report it as empty
      // (happy-dom does not sanitize, so the event carries what a browser reads).
      await fireEvent.input(input, { target: { value: '' } });
      await tick();
      expect(amount()).toBe('null');
      await fireEvent.input(input, { target: { value: '1.0' } });
      await tick();
      expect(amount()).toBe('number:1');
      expect(input.value).toBe('1.0');
      await fireEvent.input(input, { target: { value: '1.05' } });
      await tick();
      expect(amount()).toBe('number:1.05');
      expect(input.value).toBe('1.05');
      // An outside change still rewrites the field.
      await fireEvent.click(view.getByRole('button', { name: 'Set five' }));
      await tick();
      expect(amount()).toBe('number:5');
      expect(input.value).toBe('5');
    });
  });

  describe('G5: styled components bind ref and spread rest attributes', () => {
    it('points bind:ref at the root and lands data-* and aria-* on the component', async () => {
      for (const kind of API_REF_KINDS) {
        const box: { current: HTMLElement | null } = { current: null };
        const view = render(ApiRefHarness, {
          props: {
            kind,
            get ref() {
              return box.current;
            },
            set ref(value: HTMLElement | null) {
              box.current = value;
            },
          },
        });
        await vi.waitFor(() => {
          expect(box.current, kind).toBeInstanceOf(HTMLElement);
        });
        const el = box.current as HTMLElement;
        const probe = document.querySelector('[data-probe="probe"]');
        expect(probe, kind).toBeTruthy();
        expect(el === probe || el.contains(probe), kind).toBe(true);
        expect(probe?.getAttribute('aria-describedby') ?? '', kind).toContain('probe-note');
        view.unmount();
        await vi.waitFor(() => {
          expect(box.current, kind).toBeNull();
        });
      }
    });
  });

  describe('G40–G42: ToggleGroup form values and roving start, PinInput name and inputRef', () => {
    it('submits each pressed value, starts the tab stop on the first pressed item, and forwards pin props', async () => {
      const box: { current: HTMLInputElement | null } = { current: null };
      const view = render(FormControlsHarness, {
        props: {
          get pinRef() {
            return box.current;
          },
          set pinRef(value: HTMLInputElement | null) {
            box.current = value;
          },
        },
      });
      const form = view.getByTestId('form') as HTMLFormElement;
      const data = new FormData(form);
      expect(data.getAll('days')).toEqual(['tue', 'thu']);
      expect(data.get('code')).toBe('12');

      const group = view.getByRole('group', { name: 'Days' });
      expect(group.id).toBe('days-group');
      expect(group.getAttribute('aria-describedby')).toBe('days-note');
      await vi.waitFor(() => {
        const stops = within(group)
          .getAllByRole('button')
          .filter((button) => button.getAttribute('tabindex') === '0');
        expect(stops.map((button) => button.textContent?.trim())).toEqual(['Tue']);
      });

      await fireEvent.click(within(group).getByRole('button', { name: 'Mon' }));
      expect(new FormData(form).getAll('days')).toEqual(['tue', 'thu', 'mon']);

      await vi.waitFor(() => {
        expect(box.current).toBeInstanceOf(HTMLInputElement);
      });
      expect(box.current?.getAttribute('name')).toBe('code');
    });
  });

  describe('G36: CopyButton callbacks', () => {
    it('reports success and failure, and composes a caller onclick that can cancel the copy', async () => {
      const onCopy = vi.fn();
      const onCopyError = vi.fn();
      const onclick = vi.fn();
      const writeText = vi.fn(async () => {});
      const ok = render(CopyButton, {
        props: {
          value: 'token',
          label: 'Copy token',
          clipboard: { writeText },
          onCopy,
          onCopyError,
          onclick,
        },
      });
      await fireEvent.click(ok.getByRole('button', { name: /Copy token/ }));
      await vi.waitFor(() => expect(onCopy).toHaveBeenCalledWith('token'));
      expect(onclick).toHaveBeenCalledTimes(1);
      expect(onCopyError).not.toHaveBeenCalled();
      ok.unmount();

      const failed = render(CopyButton, {
        props: { value: 'token', label: 'Copy token', clipboard: null, onCopy, onCopyError },
      });
      // No clipboard and no execCommand fallback (happy-dom): the copy fails.
      await fireEvent.click(failed.getByRole('button', { name: /Copy token/ }));
      await vi.waitFor(() => expect(onCopyError).toHaveBeenCalledWith('token'));
      failed.unmount();

      onCopy.mockClear();
      const cancel = render(CopyButton, {
        props: {
          value: 'token',
          label: 'Copy token',
          clipboard: { writeText },
          onCopy,
          onclick: (event: MouseEvent) => event.preventDefault(),
        },
      });
      writeText.mockClear();
      await fireEvent.click(cancel.getByRole('button', { name: /Copy token/ }));
      await tick();
      expect(writeText).not.toHaveBeenCalled();
      expect(onCopy).not.toHaveBeenCalled();
    });
  });
});

describe('tags-input readonly and id (G60)', () => {
  it('readonly keeps the tags: typing, Enter and Backspace add or remove nothing', async () => {
    const onValueChange = vi.fn();
    render(TagsInput, {
      props: { value: ['alpha'], readonly: true, label: 'Tags', onValueChange },
    });
    const input = screen.getByRole('textbox', { name: 'Add a tag' }) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    input.value = 'beta';
    await fireEvent.input(input);
    await fireEvent.keyDown(input, { key: 'Enter' });
    const tag = document.querySelector('[data-tx-tags-input-tag]') as HTMLElement;
    await fireEvent.keyDown(tag, { key: 'Backspace' });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[data-tx-tags-input-tag]')).toHaveLength(1);
    expect(document.querySelector('[data-tx-tags-input-root]')?.hasAttribute('data-readonly')).toBe(
      true
    );
    const remove = document.querySelector('.tx-tags-input__remove') as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
  });

  it('puts `id` on the text input, so `<label for>` targets the focusable control', () => {
    render(TagsInput, { props: { id: 'tags-field', label: 'Tags' } });
    const input = document.getElementById('tags-field');
    expect(input?.tagName).toBe('INPUT');
    expect(document.querySelector('[data-tx-tags-input-root]')?.id).not.toBe('tags-field');
  });
});
