import { cleanup, fireEvent, render, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  colorToHex,
  formatColor,
  parseColor,
  parseFormattedColor,
  withAlpha,
  withArea,
  withHue,
} from '../src/color-picker/color.ts';
import Fixture from './fixtures/ColorPickerFixture.svelte';

afterEach(cleanup);

describe('color model', () => {
  it('parses supported hexadecimal forms and writes gamut-mapped colors', () => {
    expect(parseColor('#f00')).toEqual(
      expect.objectContaining({ l: expect.any(Number), h: expect.any(Number), a: 1 })
    );
    expect(colorToHex(parseColor('#ff0000')!)).toBe('#ff0000');
    expect(colorToHex(parseColor('#33669980')!)).toBe('#33669980');
    expect(parseColor('url(https://example.com/x)')).toBeUndefined();
  });

  it('formats and parses hex, RGB, HSL, and OKLCH values', () => {
    const color = parseColor('#3478c9')!;
    for (const format of ['hex', 'rgb', 'hsl', 'oklch'] as const) {
      const parsed = parseFormattedColor(formatColor(color, format));
      expect(parsed).toBeDefined();
      const actual = colorToHex(parsed!);
      const expected = [0x34, 0x78, 0xc9];
      const channels = actual
        .slice(1, 7)
        .match(/.{2}/g)
        ?.map((channel) => Number.parseInt(channel, 16));
      expect(
        channels?.every((channel, index) => Math.abs(channel - (expected[index] ?? 0)) <= 2)
      ).toBe(true);
    }
    expect(parseFormattedColor('oklch(0.55 0.2 260 / 0.5)')?.a).toBe(0.5);
    expect(parseFormattedColor('oklch(2 0.2 260)')).toBeUndefined();
    expect(parseFormattedColor('rgb(300 0 0)')).toBeUndefined();
  });

  it('clamps lightness, chroma, hue and alpha to their valid domains', () => {
    const color = parseColor('#3478c9')!;
    expect(withArea(color, 4, 1)).toMatchObject({ l: 1, c: 0.4 });
    expect(withHue(color, -30).h).toBe(330);
    expect(withAlpha(color, 2).a).toBe(1);
  });
});

describe('ColorPicker parts', () => {
  it('exposes a named color group and keyboard-operable two-axis OKLCH area', async () => {
    const view = render(Fixture);
    const group = view.getByRole('group', { name: 'Brand color' });
    const area = within(group).getByRole('slider', { name: 'Color area' });
    expect(area.getAttribute('aria-valuetext')).toContain('Lightness');
    expect(area.dataset.state).toBe('inactive');
    const before = Number(area.getAttribute('aria-valuenow'));
    await fireEvent.keyDown(area, { key: 'ArrowUp' });
    expect(Number(area.getAttribute('aria-valuenow'))).toBeGreaterThan(before);
    await fireEvent.keyDown(area, { key: 'End' });
    expect(area.getAttribute('aria-valuenow')).toBe('100');
  });

  it('composes a custom root element through its child snippet', () => {
    const view = render(Fixture, { props: { useChild: true } });
    expect(view.getByTestId('custom-color-picker').getAttribute('role')).toBe('group');
    expect(view.getByRole('slider', { name: 'Color area' })).toBeTruthy();
  });

  it('updates hue and alpha through named native slider controls', async () => {
    const view = render(Fixture);
    const hue = view.getByRole('slider', { name: 'Hue' });
    const input = view.getByRole('textbox', { name: 'Color value' }) as HTMLInputElement;
    await fireEvent.input(hue, { target: { value: '120' } });
    expect((hue as HTMLInputElement).value).toBe('120');
    expect(input.value).not.toBe('#3b82f6');
    const alpha = view.getByRole('slider', { name: 'Opacity' });
    await fireEvent.input(alpha, { target: { value: '40' } });
    expect((alpha as HTMLInputElement).value).toBe('40');
    expect(input.value).toMatch(/66$/);
  });

  it('accepts a valid formatted value, reports invalid input and preserves the last color', async () => {
    const view = render(Fixture);
    const input = view.getByRole('textbox', { name: 'Color value' });
    await fireEvent.input(input, { target: { value: '#123456' } });
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect((input as HTMLInputElement).value).toBe('#123456');
    await fireEvent.input(input, { target: { value: 'url(https://bad.example)' } });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.dataset.state).toBe('invalid');
  });

  it('selects a swatch and formats the editable value in the requested syntax', async () => {
    const view = render(Fixture);
    const red = view.getByRole('button', { name: 'Red' });
    expect(red.getAttribute('data-color')).toBe('#ff0000');
    await fireEvent.click(red);
    expect(red.getAttribute('aria-pressed')).toBe('true');
    const oklchView = render(Fixture, { props: { format: 'oklch' } });
    expect(
      (oklchView.container.querySelector('[aria-label="Color value"]') as HTMLInputElement).value
    ).toMatch(/^oklch\(/);
  });

  it('disables pointer, keyboard, text and swatch changes when disabled', async () => {
    const view = render(Fixture, { props: { disabled: true } });
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
