import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ColorPicker from '../src/components/tags-color/ColorPicker.svelte';
import TagsInput from '../src/components/tags-color/TagsInput.svelte';

afterEach(cleanup);

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('TagsInput', () => {
  it('adds tags from the input and removes them', async () => {
    const onValueChange = vi.fn();
    render(TagsInput, {
      props: {
        value: ['design'],
        label: 'Topics',
        inputLabel: 'Add a topic',
        onValueChange,
      },
    });
    const group = screen.getByRole('group', { name: 'Topics' });
    expect(within(group).getByText('design')).toBeTruthy();
    const input = screen.getByRole('textbox', { name: 'Add a topic' });
    await fireEvent.input(input, { target: { value: 'research' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    expect(onValueChange).toHaveBeenCalled();
    const last = onValueChange.mock.calls.at(-1)?.[0] as string[];
    expect(last).toContain('research');
  });

  it('refuses duplicates and keeps the draft', async () => {
    const onInvalid = vi.fn();
    render(TagsInput, {
      props: {
        value: ['design'],
        label: 'Topics',
        inputLabel: 'Add a topic',
        onInvalid,
      },
    });
    const input = screen.getByRole('textbox', { name: 'Add a topic' }) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'design' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    expect(onInvalid).toHaveBeenCalled();
    expect(onInvalid.mock.calls[0]?.[0]).toMatchObject({ reason: 'duplicate' });
  });
});

describe('ColorPicker', () => {
  it('exposes a named group with area, format field and swatches', async () => {
    const onValueChange = vi.fn();
    render(ColorPicker, {
      props: {
        value: '#3b82f6',
        label: 'Brand color',
        onValueChange,
      },
    });
    const group = screen.getByRole('group', { name: 'Brand color' });
    expect(within(group).getByRole('slider', { name: 'Color area' })).toBeTruthy();
    expect(within(group).getByRole('slider', { name: 'Hue' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Color swatches' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    await waitFor(() => expect(onValueChange).toHaveBeenCalled());
    const next = onValueChange.mock.calls.at(-1)?.[0] as string;
    expect(next.toLowerCase()).toMatch(/#ef4444|#ff0000|ef4444/);
  });

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
