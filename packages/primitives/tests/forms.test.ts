import { CalendarDate } from '@internationalized/date';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarDate as CalendarDateCalendar } from '../src/calendar/index.ts';
import { type ComboboxItemData } from '../src/combobox/context.ts';
import { createFoldedFilter, foldSearchText } from '../src/combobox/index.ts';
import ComboboxFormHarness from './ComboboxFormHarness.svelte';
import ComboboxHarness from './ComboboxHarness.svelte';
import CalendarFixture from './calendar-fixture.svelte';
import FieldOutsideHarness from './FieldOutsideHarness.svelte';
import FileDropFixture from './file-drop-fixture.svelte';
import CheckboxHarness from './fixtures/CheckboxHarness.svelte';
import ColorPickerFixture from './fixtures/ColorPickerFixture.svelte';
import DateFieldHarness from './fixtures/DateFieldHarness.svelte';
import DatePickerHarness from './fixtures/DatePickerHarness.svelte';
import SelectHarness from './fixtures/SelectHarness.svelte';
import LabelChildHarness from './LabelChildHarness.svelte';
import LabelFieldHarness from './LabelFieldHarness.svelte';
import NumberFieldHarness from './NumberFieldHarness.svelte';
import PinInputFixture from './pin-input-fixture.svelte';
import RadioGroupHarness from './RadioGroupHarness.svelte';
import Fixture from './slider-fixture.svelte';
import SwitchFixture from './switch-fixture.svelte';
import UncontrolledFixture from './switch-uncontrolled-fixture.svelte';
import TagsInputFixture from './tags-input-fixture.svelte';

// Form primitives: form participation (submit, reset, required), parsing and
// edge cases. Keyboard, focus and ARIA basics live in tests/behavior.

describe('checkbox', () => {
  afterEach(() => cleanup());

  describe('Checkbox.Root', () => {
    it('announces mixed when indeterminate', async () => {
      render(CheckboxHarness, { props: { label: 'Partial', indeterminate: true } });
      const box = screen.getByRole('checkbox', { name: 'Partial' });
      expect(box.getAttribute('aria-checked')).toBe('mixed');
      expect(box.getAttribute('data-state')).toBe('indeterminate');
      await fireEvent.click(box);
      expect(box.getAttribute('aria-checked')).toBe('true');
    });

    it('submits its value with a native form when checked', async () => {
      let submitted: Record<string, FormDataEntryValue> | null = null;
      render(CheckboxHarness, {
        props: {
          label: 'Email updates',
          name: 'updates',
          value: 'yes',
          withForm: true,
          onSubmit: (data: Record<string, FormDataEntryValue>) => {
            submitted = data;
          },
        },
      });
      await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(submitted).toEqual({});
      await fireEvent.click(screen.getByRole('checkbox', { name: 'Email updates' }));
      await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(submitted).toMatchObject({ updates: 'yes' });
    });
  });

  describe('Checkbox.Group', () => {
    it('tracks multiple values', async () => {
      render(CheckboxHarness, { props: { mode: 'group' } });
      const a = screen.getByRole('checkbox', { name: 'Alpha' });
      const b = screen.getByRole('checkbox', { name: 'Beta' });
      await fireEvent.click(a);
      await fireEvent.click(b);
      expect(a.getAttribute('aria-checked')).toBe('true');
      expect(b.getAttribute('aria-checked')).toBe('true');
      await fireEvent.click(a);
      expect(a.getAttribute('aria-checked')).toBe('false');
    });
  });
});

describe('switch', () => {
  afterEach(() => cleanup());

  describe('Switch', () => {
    it('submits its value with the form when on', async () => {
      const { getByRole, container } = render(SwitchFixture);
      const control = getByRole('switch', { name: 'Airplane mode' });
      await fireEvent.click(control);
      const form = container.querySelector('form');
      expect(form).toBeTruthy();
      const data = new FormData(form as HTMLFormElement);
      expect(Object.fromEntries(data.entries())).toMatchObject({ airplane: 'on' });
    });

    it('toggles when uncontrolled (defaultChecked, no binding)', async () => {
      const onCheckedChange = vi.fn();
      const { getByRole } = render(UncontrolledFixture, { props: { onCheckedChange } });
      const control = getByRole('switch', { name: 'Weekly digest' });
      expect(control.getAttribute('aria-checked')).toBe('true');
      await fireEvent.click(control);
      expect(control.getAttribute('aria-checked')).toBe('false');
      expect(control.getAttribute('data-state')).toBe('unchecked');
      expect(onCheckedChange).toHaveBeenCalledWith(false);
      control.focus();
      await fireEvent.keyDown(control, { key: ' ' });
      expect(control.getAttribute('aria-checked')).toBe('true');
    });
  });
});

describe('radio-group', () => {
  afterEach(cleanup);

  describe('RadioGroup', () => {
    it('does not select when readonly or group disabled', async () => {
      const onValueChange = vi.fn();
      const view = render(RadioGroupHarness, {
        props: { value: 'standard', readonly: true, onValueChange },
      });
      await fireEvent.click(view.getByRole('radio', { name: 'Drone' }));
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('submits the selected value with a named form bridge', async () => {
      const view = render(RadioGroupHarness, {
        props: { value: 'drone', name: 'delivery' },
      });
      const form = view.container.querySelector('form');
      expect(form).toBeTruthy();
      const data = new FormData(form!);
      expect(data.get('delivery')).toBe('drone');
    });
  });
});

describe('slider', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const slider = (name: string) => screen.getByRole('slider', { name });
  const now = (name: string) => Number(slider(name).getAttribute('aria-valuenow'));
  const key = (name: string, k: string, extra: Record<string, unknown> = {}) =>
    fireEvent.keyDown(slider(name), { key: k, ...extra });

  /** happy-dom has no layout: give the root a 200 × 20 track at (100, 50). */
  function mockTrack(root: HTMLElement) {
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 50,
      width: 200,
      height: 20,
      right: 300,
      bottom: 70,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    } as DOMRect);
    root.setPointerCapture = vi.fn();
    root.releasePointerCapture = vi.fn();
  }

  describe('Slider: APG roles and values', () => {
    it('positions the thumb and range with logical properties', () => {
      render(Fixture);
      expect(slider('Volume').style.getPropertyValue('inset-inline-start')).toBe('40%');
      const range = screen.getByTestId('range');
      expect(range.style.getPropertyValue('inset-inline-start')).toBe('0%');
      expect(range.style.getPropertyValue('inset-inline-end')).toBe('60%');
    });
  });

  describe('Slider: range (multiple thumbs)', () => {
    it('never lets thumbs cross, and keeps the minimum gap', async () => {
      const onValueChange = vi.fn();
      render(Fixture, { props: { type: 'multiple', minStepsBetweenThumbs: 10, onValueChange } });
      await key('Minimum', 'End');
      expect(now('Minimum')).toBe(70);
      await key('Maximum', 'Home');
      expect(now('Maximum')).toBe(80);
      expect(onValueChange).toHaveBeenLastCalledWith([70, 80]);
      expect(slider('Maximum').getAttribute('aria-valuemin')).toBe('80');
    });
  });

  describe('Slider: pointer and touch', () => {
    it('jumps to the pressed point, drags, then commits once on release', async () => {
      const onValueChange = vi.fn();
      const onValueCommit = vi.fn();
      render(Fixture, { props: { onValueChange, onValueCommit } });
      const root = screen.getByTestId('root');
      mockTrack(root);
      await fireEvent.pointerDown(root, {
        clientX: 250,
        clientY: 60,
        button: 0,
        pointerId: 7,
        pointerType: 'mouse',
      });
      expect(now('Volume')).toBe(75);
      expect(document.activeElement).toBe(slider('Volume'));
      expect(slider('Volume').dataset.state).toBe('active');
      expect(root.setPointerCapture).toHaveBeenCalledWith(7);
      await fireEvent.pointerMove(root, { clientX: 140, clientY: 60, pointerId: 7 });
      expect(now('Volume')).toBe(20);
      expect(onValueCommit).not.toHaveBeenCalled();
      await fireEvent.pointerUp(root, { clientX: 140, clientY: 60, pointerId: 7 });
      expect(onValueCommit).toHaveBeenCalledExactlyOnceWith(20);
      expect(slider('Volume').dataset.state).toBe('inactive');
      // Moving after release does nothing.
      await fireEvent.pointerMove(root, { clientX: 300, clientY: 60, pointerId: 7 });
      expect(now('Volume')).toBe(20);
      expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([75, 20]);
    });

    it('ignores the right mouse button', async () => {
      render(Fixture);
      const root = screen.getByTestId('root');
      mockTrack(root);
      await fireEvent.pointerDown(root, {
        clientX: 250,
        clientY: 60,
        button: 2,
        pointerId: 1,
        pointerType: 'mouse',
      });
      expect(now('Volume')).toBe(40);
    });
  });

  describe('Slider: forms', () => {
    it('submits one field per thumb and restores the start values on reset', async () => {
      render(Fixture, { props: { type: 'multiple', name: 'price' } });
      const form = screen.getByTestId('form') as HTMLFormElement;
      expect(new FormData(form).getAll('price')).toEqual(['20', '80']);
      await key('Minimum', 'ArrowRight');
      expect(new FormData(form).getAll('price')).toEqual(['21', '80']);
      form.reset();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(now('Minimum')).toBe(20);
      expect(new FormData(form).getAll('price')).toEqual(['20', '80']);
    });

    it('keeps the field out of the form while disabled', () => {
      render(Fixture, { props: { name: 'volume', disabled: true } });
      expect(new FormData(screen.getByTestId('form') as HTMLFormElement).getAll('volume')).toEqual(
        []
      );
    });
  });
});

describe('number-field', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('NumberField (APG spinbutton)', () => {
    const spin = (r: {
      getByRole: (role: 'spinbutton', options: { name: string }) => HTMLElement;
    }) => r.getByRole('spinbutton', { name: 'Quantity' }) as HTMLInputElement;
    const key = (target: Element, name: string, init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', {
        key: name,
        bubbles: true,
        cancelable: true,
        ...init,
      });
      target.dispatchEvent(event);
      return event;
    };

    it('reverts text that does not parse, and empties to null', async () => {
      const r = render(NumberFieldHarness, { value: 3 });
      const input = spin(r);
      await fireEvent.input(input, { target: { value: '3x' } });
      await fireEvent.blur(input);
      expect(input.value).toBe('3');
      expect(r.getByTestId('value').textContent).toBe('3');
      await fireEvent.input(input, { target: { value: '' } });
      await fireEvent.blur(input);
      expect(r.getByTestId('value').textContent).toBe('null');
      expect(input.hasAttribute('aria-valuenow')).toBe(false);
      expect(input.hasAttribute('aria-valuetext')).toBe(false);
      expect(r.getByTestId('root').hasAttribute('data-empty')).toBe(true);
    });

    it('refuses keystrokes that cannot lead to a number', () => {
      const r = render(NumberFieldHarness, {});
      const input = spin(r);
      const letter = new InputEvent('beforeinput', {
        data: 'x',
        inputType: 'insertText',
        cancelable: true,
        bubbles: true,
      });
      input.dispatchEvent(letter);
      expect(letter.defaultPrevented).toBe(true);
      const digit = new InputEvent('beforeinput', {
        data: '7',
        inputType: 'insertText',
        cancelable: true,
        bubbles: true,
      });
      input.dispatchEvent(digit);
      expect(digit.defaultPrevented).toBe(false);
    });

    it('focuses the input on a mouse press but not on touch', async () => {
      const r = render(NumberFieldHarness, { value: 1 });
      const input = spin(r);
      const up = r.getByRole('button', { name: 'Increase' });
      r.getByTestId('elsewhere').focus();
      await fireEvent.pointerDown(up, { pointerType: 'touch', pointerId: 2 });
      await fireEvent.pointerUp(up, { pointerId: 2 });
      expect(document.activeElement).not.toBe(input);
      expect(input.getAttribute('aria-valuenow')).toBe('2');
      await fireEvent.pointerDown(up, { pointerType: 'mouse', button: 0, pointerId: 3 });
      await fireEvent.pointerUp(up, { pointerId: 3 });
      expect(document.activeElement).toBe(input);
      expect(input.getAttribute('aria-valuenow')).toBe('3');
    });

    it('repeats while held and steps once for assistive-technology clicks', async () => {
      vi.useFakeTimers();
      const r = render(NumberFieldHarness, { value: 0 });
      const input = spin(r);
      const down = r.getByRole('button', { name: 'Decrease' });
      await fireEvent.pointerDown(down, { pointerType: 'mouse', button: 0, pointerId: 4 });
      vi.advanceTimersByTime(400 + 60 * 3);
      await fireEvent.pointerUp(down, { pointerId: 4 });
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      // One step on press, then ticks at 400, 460, 520 and 580 ms.
      expect(input.getAttribute('aria-valuenow')).toBe('-5');
      // A pointer click after the press does not step again.
      await fireEvent.click(down, { detail: 1 });
      expect(input.getAttribute('aria-valuenow')).toBe('-5');
      await fireEvent.click(down, { detail: 0 });
      expect(input.getAttribute('aria-valuenow')).toBe('-6');
    });

    it('steps with the wheel only when allowed and focused', async () => {
      const r = render(NumberFieldHarness, { value: 0, allowWheel: true });
      const input = spin(r);
      await fireEvent.wheel(input, { deltaY: -10 });
      expect(input.getAttribute('aria-valuenow')).toBe('0');
      input.focus();
      const wheel = new WheelEvent('wheel', { deltaY: -10, bubbles: true, cancelable: true });
      input.dispatchEvent(wheel);
      await Promise.resolve();
      expect(wheel.defaultPrevented).toBe(true);
      expect(input.getAttribute('aria-valuenow')).toBe('1');
    });

    it('submits the number, not the formatted text, and restores it on reset', async () => {
      const r = render(NumberFieldHarness, {
        defaultValue: 1234.5,
        name: 'amount',
        required: true,
      });
      const form = r.getByTestId('form') as HTMLFormElement;
      expect(new FormData(form).get('amount')).toBe('1234.5');
      const input = spin(r);
      expect(input.hasAttribute('name')).toBe(false);
      expect(input.getAttribute('aria-required')).toBe('true');
      key(input, 'ArrowUp');
      await Promise.resolve();
      // Off the step grid, the first step lands on it.
      expect(new FormData(form).get('amount')).toBe('1235');
      form.reset();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(input.getAttribute('aria-valuenow')).toBe('1234.5');
    });
  });
});

describe('tags-input', () => {
  afterEach(cleanup);

  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const input = () => screen.getByRole('textbox', { name: 'Add a topic' }) as HTMLInputElement;
  const tagNames = () =>
    screen.getAllByRole('listitem').map((item) => item.querySelector('span')?.textContent);
  const status = () => screen.getByRole('status').textContent;

  async function type(text: string) {
    await fireEvent.input(input(), { target: { value: text } });
  }

  async function press(key: string, target: Element = document.activeElement as Element) {
    await fireEvent.keyDown(target, { key });
    await tick();
  }

  function paste(text: string) {
    const event = new Event('paste', { bubbles: true, cancelable: true }) as Event & {
      clipboardData: { getData: () => string };
    };
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
    input().dispatchEvent(event);
    return event;
  }

  describe('TagsInput: adding', () => {
    it('does not submit the form with Enter while there is text, but lets an empty Enter through', async () => {
      render(TagsInputFixture);
      await type('ops');
      const withText = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      input().dispatchEvent(withText);
      expect(withText.defaultPrevented).toBe(true);
      await tick();
      expect(input().value).toBe('');
      const empty = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      input().dispatchEvent(empty);
      expect(empty.defaultPrevented).toBe(false);
    });

    it('stops at max and runs the validator, announcing its message', async () => {
      render(TagsInputFixture, {
        props: {
          max: 3,
          validate: (value: string) => (value.length > 10 ? 'Keep topics short' : true),
        },
      });
      await type('a very long topic');
      await press('Enter', input());
      expect(status()).toBe('Keep topics short');
      await type('ux');
      await press('Enter', input());
      await type('ops');
      await press('Enter', input());
      expect(tagNames()).toEqual(['design', 'research', 'ux']);
      expect(status()).toBe('You can add up to 3 tags');
    });

    it('splits pasted text into tags, after what was already typed', async () => {
      render(TagsInputFixture);
      await type('mob');
      const event = paste('ile, web\nqa');
      await tick();
      expect(event.defaultPrevented).toBe(true);
      expect(tagNames()).toEqual(['design', 'research', 'mobile', 'web', 'qa']);
      expect(input().value).toBe('');
    });
  });

  describe('TagsInput: forms', () => {
    it('submits one field per tag and restores the start tags on reset', async () => {
      const onsubmit = vi.fn();
      render(TagsInputFixture, { props: { name: 'topic', onsubmit } });
      await type('ops');
      await press('Enter', input());
      await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      const submitted = onsubmit.mock.calls[0]?.[0] as FormData | undefined;
      expect(submitted?.getAll('topic')).toEqual(['design', 'research', 'ops']);
      (screen.getByTestId('form') as HTMLFormElement).reset();
      await tick();
      await tick();
      expect(tagNames()).toEqual(['design', 'research']);
    });

    it('blocks submission while required and empty, without submitting the helper field', () => {
      render(TagsInputFixture, { props: { value: [], name: 'topic', required: true } });
      const form = screen.getByTestId('form') as HTMLFormElement;
      expect(form.checkValidity()).toBe(false);
      expect([...new FormData(form).keys()]).toEqual([]);
    });

    it('moves focus to the text input when the browser rejects an empty required field', async () => {
      render(TagsInputFixture, { props: { value: [], required: true } });
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).focus();
      (screen.getByTestId('form') as HTMLFormElement).checkValidity();
      await tick();
      expect(document.activeElement).toBe(input());
    });

    it('follows a required prop that changes after mount', async () => {
      const { rerender } = render(TagsInputFixture, { props: { value: [], required: false } });
      const form = screen.getByTestId('form') as HTMLFormElement;
      expect(form.checkValidity()).toBe(true);
      await rerender({ value: [], required: true });
      expect(form.checkValidity()).toBe(false);
    });
  });
});

describe('pin-input', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  describe('PinInput', () => {
    const input = () =>
      screen.getByRole('textbox', { name: 'Verification code' }) as HTMLInputElement;
    const type = async (text: string) => {
      const field = input();
      field.value = text;
      await fireEvent.input(field);
    };

    it('takes allowed characters and refuses others, keeping the code', async () => {
      const onValueChange = vi.fn();
      render(PinInputFixture, { props: { onValueChange } });
      await type('12');
      expect(screen.getByTestId('value').textContent).toBe('12');
      expect(screen.getByTestId('cell-1').textContent).toBe('2');
      expect(screen.getByTestId('cell-1').getAttribute('data-state')).toBe('filled');
      expect(screen.getByTestId('cell-2').getAttribute('data-state')).toBe('empty');
      await type('12a');
      expect(input().value).toBe('12');
      expect(onValueChange.mock.calls.map(([v]) => v)).toEqual(['12']);
    });

    it('reports completion once, when the last cell is filled', async () => {
      const onComplete = vi.fn();
      render(PinInputFixture, { props: { onComplete } });
      await type('12345');
      expect(onComplete).not.toHaveBeenCalled();
      await type('123456');
      expect(onComplete).toHaveBeenCalledExactlyOnceWith('123456');
      // The same code again (an input event with no change) does not report it twice.
      await type('123456');
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(input().getAttribute('data-state')).toBe('complete');
      await type('12345');
      expect(input().getAttribute('data-state')).toBe('incomplete');
    });

    it('pastes a spaced code into the cells and completes it', async () => {
      const onComplete = vi.fn();
      render(PinInputFixture, { props: { onComplete } });
      input().focus();
      await fireEvent.paste(input(), { clipboardData: { getData: () => '123 456' } });
      expect(input().value).toBe('123456');
      expect(screen.getByTestId('last-cell').textContent).toBe('6');
      expect(onComplete).toHaveBeenCalledWith('123456');
      await type('');
      await fireEvent.paste(input(), { clipboardData: { getData: () => 'abc' } });
      expect(input().value).toBe('');
    });

    it('masks the code in the cells and from assistive tech', async () => {
      render(PinInputFixture, { props: { mask: true } });
      const field = document.querySelector('input') as HTMLInputElement;
      expect(field.type).toBe('password');
      field.value = '42';
      await fireEvent.input(field);
      expect(screen.getByTestId('cell-0').textContent).toBe('•');
      expect(screen.getByTestId('cell-1').textContent).toBe('•');
    });
  });
});

describe('combobox', () => {
  afterEach(cleanup);

  describe('@texuli/primitives/combobox', () => {
    it('aborts a superseded async request and only publishes the latest results', async () => {
      let firstSignal: AbortSignal | undefined;
      const loadOptions = (query: string, signal: AbortSignal) =>
        new Promise<readonly { value: string; label: string }[]>((resolve) => {
          if (query === 'a') firstSignal = signal;
          setTimeout(
            () => resolve([{ value: query, label: query.toUpperCase() }]),
            query === 'a' ? 20 : 0
          );
        });
      render(ComboboxHarness, { props: { items: [], loadOptions } });
      const input = screen.getByRole('combobox', { name: 'Colors' });
      await fireEvent.input(input, { target: { value: 'a' } });
      await fireEvent.input(input, { target: { value: 'b' } });
      await waitFor(() => expect(screen.getByRole('option', { name: 'B' })).toBeTruthy());
      expect(firstSignal?.aborted).toBe(true);
      expect(screen.queryByRole('option', { name: 'A' })).toBeNull();
    });

    it('virtualizes the option window only when the collection exceeds 200 items', async () => {
      const items = Array.from({ length: 240 }, (_, index) => ({
        value: String(index),
        label: `Item ${index}`,
      }));
      render(ComboboxHarness, { props: { items } });
      await fireEvent.click(screen.getByRole('button', { name: 'Show colors' }));
      expect(screen.getAllByRole('option').length).toBeLessThan(20);
      expect(screen.getAllByRole('option')[0]?.textContent).toBe('Item 0');
      const input = screen.getByRole('combobox', { name: 'Colors' });
      input.focus();
      for (let index = 0; index < 25; index += 1) {
        await fireEvent.keyDown(input, { key: 'ArrowDown' });
      }
      const activeId = input.getAttribute('aria-activedescendant');
      const activeOption = activeId ? document.getElementById(activeId) : null;
      expect(activeOption?.textContent).toBe('Item 24');
      expect(activeOption?.getAttribute('aria-posinset')).toBe('25');
    });

    it('shows Error with retry after loadOptions rejects', async () => {
      let attempts = 0;
      const loadOptions = () => {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error('Network offline'));
        return Promise.resolve([{ value: 'blue', label: 'Blue' }] as const);
      };
      const { container } = render(ComboboxHarness, { props: { items: [], loadOptions } });
      const input = screen.getByRole('combobox', { name: 'Colors' });
      await fireEvent.input(input, { target: { value: 'b' } });
      await waitFor(() =>
        expect(container.querySelector('[data-tx-combobox-error]')?.textContent).toMatch(
          /Network offline/
        )
      );
      await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await waitFor(() => expect(screen.getByRole('option', { name: 'Blue' })).toBeTruthy());
      expect(attempts).toBe(2);
    });

    it('shows Empty when an async load returns no options; an unloaded list stays idle', async () => {
      const loadOptions = () => Promise.resolve([] as const);
      const { container } = render(ComboboxHarness, { props: { items: [], loadOptions } });
      const empty = () => container.querySelector('[data-tx-combobox-empty]');
      // Opening does not load, so there is nothing to call empty yet.
      await fireEvent.click(screen.getByRole('button', { name: 'Show colors' }));
      expect(empty()).toBeNull();
      await fireEvent.input(screen.getByRole('combobox', { name: 'Colors' }), {
        target: { value: 'q' },
      });
      await waitFor(() => expect(empty()?.textContent).toMatch(/No results/i));
    });
  });
});

describe('combobox-filter-form', () => {
  afterEach(cleanup);

  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  async function type(text: string): Promise<HTMLInputElement> {
    const input = screen.getByRole('combobox', { name: 'City' }) as HTMLInputElement;
    input.focus();
    await fireEvent.input(input, { target: { value: text } });
    return input;
  }

  const optionLabels = () => screen.queryAllByRole('option').map((option) => option.textContent);

  async function choose(text: string, label: string): Promise<void> {
    await type(text);
    await fireEvent.click(screen.getByRole('option', { name: label }));
  }

  const form = () => screen.getByRole('form', { name: 'Trip' }) as HTMLFormElement;

  describe('@texuli/primitives/combobox filter', () => {
    it('a custom filter replaces the default instead of narrowing it', async () => {
      // Value prefix only: "york" matches a label (default) but no value prefix.
      render(ComboboxFormHarness, {
        props: {
          filter: (item: ComboboxItemData, query: string) =>
            item.value.toLowerCase().startsWith(query.toLowerCase()),
        },
      });
      await type('york');
      expect(optionLabels()).toEqual([]);
      await type('europe/');
      expect(optionLabels()).toEqual(['Lisbon', 'Zürich']);
    });

    it('folds accents and case, and can match values too', async () => {
      expect(foldSearchText('São Paulo')).toBe('sao paulo');
      expect(foldSearchText('ZÜRICH')).toBe('zurich');
      expect(foldSearchText('İstanbul', 'tr')).toBe('istanbul');
      render(ComboboxFormHarness, {
        props: { filter: createFoldedFilter({ fields: (item) => [item.label, item.value] }) },
      });
      await type('sao paulo');
      expect(optionLabels()).toEqual(['São Paulo']);
      await type('new_york');
      expect(optionLabels()).toEqual(['New York']);
      await type('zurich');
      expect(optionLabels()).toEqual(['Zürich']);
    });
  });

  describe('@texuli/primitives/combobox form participation', () => {
    it('submits one entry per value when multiple', async () => {
      render(ComboboxFormHarness, { props: { multiple: true } });
      expect(new FormData(form()).getAll('city')).toEqual([]);
      await choose('lis', 'Lisbon');
      await choose('new', 'New York');
      expect(new FormData(form()).getAll('city')).toEqual(['Europe/Lisbon', 'America/New_York']);
    });

    it('required blocks submission until a value is chosen, with the given message', async () => {
      render(ComboboxFormHarness, {
        props: { required: true, requiredMessage: 'Choose a city to continue.' },
      });
      await tick();
      const bridge = form().querySelector<HTMLInputElement>('[data-tx-form-bridge]');
      expect(bridge?.hasAttribute('name')).toBe(false);
      expect(form().checkValidity()).toBe(false);
      expect(bridge?.validationMessage).toBe('Choose a city to continue.');
      await choose('lis', 'Lisbon');
      await tick();
      expect(form().checkValidity()).toBe(true);
      // The constraint field never submits: only the value does.
      expect([...new FormData(form()).keys()]).toEqual(['city']);
    });

    it('a form reset restores the default value and its label', async () => {
      render(ComboboxFormHarness, { props: { defaultValue: 'Europe/Zurich' } });
      expect(new FormData(form()).getAll('city')).toEqual(['Europe/Zurich']);
      await choose('lis', 'Lisbon');
      expect(new FormData(form()).getAll('city')).toEqual(['Europe/Lisbon']);
      form().reset();
      await tick();
      await tick();
      expect(new FormData(form()).getAll('city')).toEqual(['Europe/Zurich']);
      expect((screen.getByRole('combobox', { name: 'City' }) as HTMLInputElement).value).toBe(
        'Zürich'
      );
    });

    it('a disabled combobox submits nothing and is not required', async () => {
      render(ComboboxFormHarness, { props: { disabled: true, required: true } });
      await tick();
      expect(new FormData(form()).getAll('city')).toEqual([]);
      expect(form().checkValidity()).toBe(true);
    });

    it('adds, moves and removes the form field when name, required or form change after mount', async () => {
      const { rerender } = render(ComboboxFormHarness, { props: { name: '' } });
      await tick();
      const bridge = () => document.querySelector<HTMLInputElement>('[data-tx-form-bridge]');
      expect(bridge()).toBeNull();
      expect([...new FormData(form()).keys()]).toEqual([]);

      await rerender({ name: 'city', required: true });
      await tick();
      expect(bridge()?.required).toBe(true);
      expect(form().checkValidity()).toBe(false);
      expect(new FormData(form()).getAll('city')).toEqual(['']);

      // Moving the field to another form takes the value and the constraint with it.
      await rerender({ name: 'city', required: true, form: 'other-form' });
      await tick();
      const other = screen.getByRole('form', { name: 'Other' }) as HTMLFormElement;
      expect(bridge()?.getAttribute('form')).toBe('other-form');
      expect(form().querySelector('input[type="hidden"]')?.getAttribute('form')).toBe('other-form');
      // (happy-dom keeps an input's first form owner when its form attribute
      // changes, so the original form's validity is not checked here; browsers
      // re-associate the field.)
      expect(other.checkValidity()).toBe(false);
      await choose('lis', 'Lisbon');
      await tick();
      expect(new FormData(other).getAll('city')).toEqual(['Europe/Lisbon']);
      expect(other.checkValidity()).toBe(true);

      await rerender({ name: 'city', required: false, form: undefined });
      await tick();
      expect(bridge()?.required).toBe(false);
      expect(bridge()?.hasAttribute('form')).toBe(false);

      await rerender({ name: '', required: false });
      await tick();
      expect(bridge()).toBeNull();
      expect([...new FormData(form()).keys()]).toEqual([]);
    });
  });
});

describe('select', () => {
  afterEach(() => cleanup());

  describe('Select', () => {
    it('marks disabled options and keeps the value when forced-clicked', async () => {
      render(SelectHarness);
      await fireEvent.click(screen.getByRole('combobox', { name: 'Plan' }));
      const business = screen.getByRole('option', { name: 'Business' });
      expect(business.getAttribute('aria-disabled')).toBe('true');
      await fireEvent.click(business);
      expect(screen.getByRole('combobox', { name: 'Plan' }).textContent).toContain('Free');
    });

    it('submits the chosen value with the form', async () => {
      let submitted: Record<string, FormDataEntryValue> | null = null;
      render(SelectHarness, {
        props: {
          withForm: true,
          onSubmit: (data: Record<string, FormDataEntryValue>) => {
            submitted = data;
          },
        },
      });
      await fireEvent.click(screen.getByRole('combobox', { name: 'Plan' }));
      await fireEvent.click(screen.getByRole('option', { name: 'Team' }));
      await fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));
      expect(submitted).toMatchObject({ plan: 'team' });
    });
  });

  describe('Select.Group', () => {
    it('typeahead skips disabled items across groups', async () => {
      render(SelectHarness, { props: { grouped: true } });
      const trigger = screen.getByRole('combobox', { name: 'Plan' });
      trigger.focus();
      await fireEvent.keyDown(trigger, { key: 'Enter' });
      await screen.findByRole('listbox');
      // "b" matches disabled Business only — enabled filter must skip it so Enter
      // does not choose Business (stays Free or another enabled option).
      await fireEvent.keyDown(trigger, { key: 'b' });
      await fireEvent.keyDown(trigger, { key: 'Enter' });
      await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
      expect(trigger.textContent).not.toContain('Business');
      // Cross-group pick via typeahead on a fresh open (Enterprise).
      await fireEvent.click(trigger);
      await screen.findByRole('listbox');
      await fireEvent.click(screen.getByRole('option', { name: 'Enterprise' }));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
      expect(trigger.textContent).toContain('Enterprise');
    });
  });
});

describe('label', () => {
  describe('Field', () => {
    it('never references a part that is not mounted', async () => {
      const { getByLabelText, rerender } = render(LabelFieldHarness, {
        id: 'billing',
        invalid: true,
        showDescription: false,
        showError: false,
      });
      const input = getByLabelText('Work email');
      expect(input.hasAttribute('aria-describedby')).toBe(false);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      await rerender({ id: 'billing', invalid: true, showDescription: true, showError: true });
      expect(input.getAttribute('aria-describedby')).toBe('billing-description billing-error');
      for (const id of (input.getAttribute('aria-describedby') ?? '').split(' ')) {
        expect(document.getElementById(id)).not.toBeNull();
      }
    });

    it('keeps the author’s own description references', () => {
      const { getByLabelText } = render(LabelFieldHarness, {
        id: 'billing',
        extraDescribedBy: 'extra-hint',
      });
      expect(getByLabelText('Work email').getAttribute('aria-describedby')).toBe(
        'billing-description extra-hint'
      );
    });

    it('generates unique ids per field when none is given', () => {
      const first = render(LabelFieldHarness, {});
      const second = render(LabelFieldHarness, {});
      const ids = [first, second].map(
        (r) => (r.container.querySelector('input[type="email"]') as HTMLElement).id
      );
      expect(new Set(ids).size).toBe(2);
    });

    it('names the missing provider', () => {
      expect(() => render(FieldOutsideHarness)).toThrow(/Missing Field provider/);
    });
  });

  describe('Label', () => {
    it('composes onto a child element; the consumer handler runs first and can opt out', () => {
      const onmousedown = vi.fn((event: MouseEvent) => event.preventDefault());
      const { getByTestId } = render(LabelChildHarness, { onmousedown });
      const child = getByTestId('child-label');
      expect(child.tagName).toBe('SPAN');
      expect(child.getAttribute('for')).toBe('target');
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 });
      child.dispatchEvent(event);
      expect(onmousedown).toHaveBeenCalledOnce();
      expect(event.defaultPrevented).toBe(true);
    });
  });
});

describe('date-field', () => {
  afterEach(cleanup);

  describe('DateField.Root and TimeField.Root', () => {
    it('submits canonical date and time values through named hidden controls', async () => {
      render(DateFieldHarness);
      const form = document.createElement('form');
      form.append(...screen.getAllByRole('group'));
      const values = new FormData(form);
      expect(values.get('date')).toBe('2024-02-29');
      expect(values.get('time')).toBe('17:05');
    });

    it('updates a 12-hour time segment and period while retaining canonical 24-hour value', async () => {
      render(DateFieldHarness);
      const hour = screen.getByRole('spinbutton', { name: 'Hour' });
      await fireEvent.input(hour, { target: { value: '6' } });
      expect(screen.getByLabelText('Selected time').textContent).toBe('18:05');
      await fireEvent.change(screen.getByRole('combobox', { name: 'AM or PM' }), {
        target: { value: 'AM' },
      });
      expect(screen.getByLabelText('Selected time').textContent).toBe('06:05');
    });
  });
});

describe('date-picker', () => {
  const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');
  const settle = async () => {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();
  };

  describe('DatePicker (APG date picker dialog)', () => {
    it('keeps the dialog open when closeOnSelect is false', async () => {
      render(DatePickerHarness, { props: { closeOnSelect: false } });
      await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
      const dialog = await screen.findByRole('dialog');
      await fireEvent.click(within(dialog).getByRole('button', { name: 'Friday, March 20, 2026' }));
      await settle();
      expect(state().value).toBe('2026-03-20');
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
  });

  describe('DateRangePicker', () => {
    it('orders an end picked before the start', async () => {
      render(DatePickerHarness, { props: { range: { start: '2026-03-20', end: null } } });
      await fireEvent.click(screen.getByRole('button', { name: /^Choose stay, Friday, March 20/ }));
      const dialog = await screen.findByRole('dialog');
      await fireEvent.click(within(dialog).getByRole('button', { name: 'Friday, March 20, 2026' }));
      await settle();
      await fireEvent.click(within(dialog).getByRole('button', { name: 'Sunday, March 15, 2026' }));
      await settle();
      expect(state().range).toEqual({ start: '2026-03-15', end: '2026-03-20' });
    });

    it('edits the ends through start and end date fields in a named group', async () => {
      render(DatePickerHarness, { props: { range: { start: '2026-03-10', end: '2026-03-12' } } });
      const group = screen.getByRole('group', { name: 'Stay' });
      const start = within(group).getByRole('group', { name: 'Start date' });
      const end = within(group).getByRole('group', { name: 'End date' });
      expect(
        (within(start).getByRole('spinbutton', { name: 'Day' }) as HTMLInputElement).value
      ).toBe('10');
      await fireEvent.input(within(end).getByRole('spinbutton', { name: 'Day' }), {
        target: { value: '13' },
      });
      await settle();
      expect(state().range).toEqual({ start: '2026-03-10', end: '2026-03-13' });
    });
  });

  describe('opening focus (APG date picker dialog)', () => {
    afterEach(() => vi.useRealTimers());
    /** A fixed "today": only Date is faked, timers stay real. */
    const today = (iso: string) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(`${iso}T12:00:00`));
    };
    const focusedDay = () => document.activeElement?.getAttribute('aria-label');

    it('focuses the first enabled day of the month when today is unavailable', async () => {
      today('2026-04-08');
      render(DatePickerHarness, {
        props: {
          value: null,
          // Today and the first days of April are unavailable.
          isDateUnavailable: (date: CalendarDate) =>
            date.year === 2026 && date.month === 4 && date.day <= 8,
        },
      });
      await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
      const dialog = await screen.findByRole('dialog', { name: 'Choose date' });
      await waitFor(() => expect(focusedDay()).toBe('Thursday, April 9, 2026'));
      // The grid keeps one tab stop, on that day.
      expect(dialog.querySelectorAll('[data-calendar-date][tabindex="0"]')).toHaveLength(1);
    });

    it('focuses the first enabled day after a minimum that excludes today', async () => {
      today('2026-04-08');
      render(DatePickerHarness, { props: { value: null, minValue: '2026-04-20' } });
      await fireEvent.click(screen.getByRole('button', { name: /^Choose date/ }));
      await screen.findByRole('dialog', { name: 'Choose date' });
      await waitFor(() => expect(focusedDay()).toBe('Monday, April 20, 2026'));
    });

    it('focuses the range start, else today', async () => {
      today('2026-04-08');
      render(DatePickerHarness, { props: { range: { start: '2026-03-02', end: '2026-03-06' } } });
      await fireEvent.click(screen.getByRole('button', { name: /^Choose stay, / }));
      await screen.findByRole('dialog', { name: 'Choose stay dates' });
      await waitFor(() => expect(focusedDay()).toBe('Monday, March 2, 2026'));
      cleanup();
      render(DatePickerHarness);
      await fireEvent.click(screen.getByRole('button', { name: 'Choose stay' }));
      await screen.findByRole('dialog', { name: 'Choose stay dates' });
      await waitFor(() => expect(focusedDay()).toBe('Wednesday, April 8, 2026'));
    });
  });
});

describe('calendar', () => {
  afterEach(() => cleanup());

  const grid = () => screen.getByRole('grid', { name: 'February 2024' });
  const dateButton = (day: number) =>
    within(grid()).getByRole('button', { name: new RegExp(`February ${day}, 2024`) });

  describe('Calendar', () => {
    it('enforces min, max, unavailable dates, and month navigation bounds', async () => {
      render(CalendarFixture);
      expect(dateButton(9).hasAttribute('disabled')).toBe(true);
      expect(dateButton(16).hasAttribute('disabled')).toBe(true);
      expect(screen.getByRole('button', { name: 'Previous month' }).hasAttribute('disabled')).toBe(
        true
      );
      await fireEvent.click(dateButton(16));
      expect(screen.getByRole('gridcell', { selected: true }).contains(dateButton(15))).toBe(true);
    });

    it('uses the requested calendar and locale in the heading and date labels', () => {
      render(CalendarFixture, {
        props: {
          calendar: 'buddhist',
          locale: 'th-TH',
          defaultFocusedValue: new CalendarDateCalendar(2024, 2, 15),
        },
      });
      expect(screen.getByRole('grid').getAttribute('aria-label')).toMatch(/2567/);
      expect(
        within(screen.getByRole('grid'))
          .getByRole('button', { name: /15/ })
          .getAttribute('aria-label')
      ).toContain('15');
    });

    it('allows an explicit week start to override the locale', () => {
      render(CalendarFixture, { props: { weekStartsOn: 1 } });
      expect(within(grid()).getAllByRole('columnheader')[0]?.textContent).toBe('Mon');
    });
  });
});

describe('color-picker', () => {
  afterEach(cleanup);

  describe('ColorPicker parts', () => {
    it('accepts a valid formatted value, reports invalid input and preserves the last color', async () => {
      const view = render(ColorPickerFixture);
      const input = view.getByRole('textbox', { name: 'Color value' });
      await fireEvent.input(input, { target: { value: '#123456' } });
      expect(input.getAttribute('aria-invalid')).toBeNull();
      expect((input as HTMLInputElement).value).toBe('#123456');
      await fireEvent.input(input, { target: { value: 'url(https://bad.example)' } });
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.dataset.state).toBe('invalid');
    });

    it('disables pointer, keyboard, text and swatch changes when disabled', async () => {
      const view = render(ColorPickerFixture, { props: { disabled: true } });
      const input = view.getByRole('textbox', { name: 'Color value' }) as HTMLInputElement;
      const before = input.value;
      const area = view.getByRole('slider', { name: 'Color area' });
      expect(area.getAttribute('aria-disabled')).toBe('true');
      await fireEvent.keyDown(area, { key: 'ArrowUp' });
      await fireEvent.click(view.getByRole('button', { name: 'Red' }));
      expect(input.value).toBe(before);
      expect((view.getByRole('slider', { name: 'Hue' }) as HTMLInputElement).disabled).toBe(true);
      expect(input.disabled).toBe(true);
    });
  });
});

describe('file-drop', () => {
  afterEach(() => cleanup());

  function makeFile(name: string, type = 'text/plain', size = 1): File {
    return new File([new Uint8Array(size)], name, { type });
  }

  describe('FileDrop.Root', () => {
    it('keeps disabled inputs inert when files are dropped', async () => {
      render(FileDropFixture);
      const group = screen.getByRole('group', { name: 'Locked uploads' });
      const file = makeFile('blocked.txt');
      const event = fireEvent.drop(group, {
        dataTransfer: { types: ['Files'], files: [file], dropEffect: 'none' },
      });

      await event;
      expect(group.querySelector('input')?.disabled).toBe(true);
      expect(group.getAttribute('data-state')).toBe('disabled');
      expect(group.querySelector('[role="alert"]')).toBeNull();
    });
  });
});
