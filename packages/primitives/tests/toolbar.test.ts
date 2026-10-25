import { cleanup, fireEvent, render, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Fixture from './toolbar-fixture.svelte';

afterEach(cleanup);

const setup = async (props: Record<string, unknown> = {}) => {
  const view = render(Fixture, { props });
  await tick();
  const toolbar = view.getByRole('toolbar', { name: 'Formatting' });
  const item = (name: string) =>
    [...toolbar.querySelectorAll<HTMLElement>('[data-toolbar-item]')].find(
      (node) => node.textContent?.trim() === name
    ) as HTMLElement;
  return { view, toolbar, item };
};

const tabStops = (toolbar: HTMLElement) =>
  [...toolbar.querySelectorAll<HTMLElement>('[data-toolbar-item]')]
    .filter((node) => node.tabIndex === 0)
    .map((node) => node.textContent?.trim());

describe('Toolbar (APG toolbar)', () => {
  it('is a named toolbar whose orientation is announced only when vertical', async () => {
    const { toolbar } = await setup();
    expect(toolbar.hasAttribute('aria-orientation')).toBe(false);
    expect(toolbar.dataset.orientation).toBe('horizontal');
    cleanup();
    const vertical = await setup({ orientation: 'vertical' });
    expect(vertical.toolbar.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('has exactly one Tab stop: the first item, then the last one used', async () => {
    const { toolbar, item } = await setup();
    expect(tabStops(toolbar)).toEqual(['Bold']);
    item('Italic').focus();
    await fireEvent.focusIn(item('Italic'));
    expect(tabStops(toolbar)).toEqual(['Italic']);
  });

  it('moves with the arrows, Home and End, wrapping by default', async () => {
    const { item } = await setup();
    item('Bold').focus();
    await fireEvent.keyDown(item('Bold'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(item('Italic'));
    await fireEvent.keyDown(item('Italic'), { key: 'End' });
    expect(document.activeElement?.textContent).toBe('Unsafe');
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(item('Bold'));
    await fireEvent.keyDown(item('Bold'), { key: 'ArrowLeft' });
    expect(document.activeElement?.textContent).toBe('Unsafe');
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });
    expect(document.activeElement).toBe(item('Bold'));
    // Up and Down do nothing in a horizontal toolbar.
    await fireEvent.keyDown(item('Bold'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('Bold'));
  });

  it('stops at the ends without loop, and uses Up and Down when vertical', async () => {
    const { item } = await setup({ loop: false, orientation: 'vertical' });
    item('Bold').focus();
    await fireEvent.keyDown(item('Bold'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(item('Bold'));
    await fireEvent.keyDown(item('Bold'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('Italic'));
  });

  it('mirrors left and right in right to left', async () => {
    const { item } = await setup({ dir: 'rtl' });
    item('Bold').focus();
    await fireEvent.keyDown(item('Bold'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(item('Italic'));
  });

  it('keeps disabled items focusable but inert', async () => {
    const onSave = vi.fn();
    const { item } = await setup({ onSave });
    const publish = item('Publish');
    expect(publish.getAttribute('aria-disabled')).toBe('true');
    expect(publish.hasAttribute('disabled')).toBe(false);
    await fireEvent.click(publish);
    expect(onSave).not.toHaveBeenCalled();
    item('Save').focus();
    await fireEvent.keyDown(item('Save'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(publish);
    await fireEvent.click(item('Save'));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('presses multiple-choice items as toggle buttons', async () => {
    const { view, item } = await setup();
    const group = view.getByRole('group', { name: 'Text style' });
    expect(within(group).getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe(
      'false'
    );
    await fireEvent.click(item('Bold'));
    await fireEvent.click(item('Italic'));
    expect(item('Bold').getAttribute('aria-pressed')).toBe('true');
    expect(item('Italic').dataset.state).toBe('on');
    await fireEvent.click(item('Bold'));
    expect(item('Bold').getAttribute('aria-pressed')).toBe('false');
  });

  it('makes a single-choice group a radio group with one checked radio', async () => {
    const onValueChange = vi.fn();
    const { view } = await setup({ onValueChange });
    const group = view.getByRole('radiogroup', { name: 'Alignment' });
    const radio = (name: string) => within(group).getByRole('radio', { name });
    expect(radio('Left').getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(radio('Center'));
    expect(radio('Center').getAttribute('aria-checked')).toBe('true');
    expect(radio('Left').getAttribute('aria-checked')).toBe('false');
    expect(onValueChange).toHaveBeenLastCalledWith('center');
    // A disabled radio cannot be chosen.
    expect(radio('Right').getAttribute('aria-disabled')).toBe('true');
    await fireEvent.click(radio('Right'));
    expect(radio('Center').getAttribute('aria-checked')).toBe('true');
  });

  it('runs separators across the toolbar, never focusable', async () => {
    const { view, toolbar } = await setup();
    const separator = view.getByTestId('sep');
    expect(separator.getAttribute('role')).toBe('separator');
    expect(separator.getAttribute('aria-orientation')).toBe('vertical');
    expect(separator.hasAttribute('data-toolbar-item')).toBe(false);
    expect(within(toolbar).getAllByRole('separator')).toHaveLength(2);
  });

  it('passes links through the URL policy', async () => {
    const { toolbar } = await setup();
    const help = within(toolbar).getByRole('link', { name: 'Help' });
    expect(help.getAttribute('href')).toBe('https://example.com/help');
    const unsafe = within(toolbar).getByText('Unsafe');
    expect(unsafe.hasAttribute('href')).toBe(false);
    expect(unsafe.getAttribute('aria-disabled')).toBe('true');
  });
});
