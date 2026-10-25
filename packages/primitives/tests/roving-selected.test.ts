import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import RovingSelectedFixture from './fixtures/RovingSelectedFixture.svelte';
import ToggleGroupFixture from './fixtures/ToggleGroupFixture.svelte';
import RadioGroupHarness from './RadioGroupHarness.svelte';
import TabsHarness from './TabsHarness.svelte';

/*
 * FIX-roving-selected: in a single-selection widget the selected item is the
 * only tab stop (WAI-ARIA APG radio group and tabs), at mount and after the
 * value changes; the first enabled item only when nothing is selected.
 */

afterEach(() => cleanup());

/** The accessible names of the items with tabIndex 0. */
function tabStops(container: HTMLElement, role: string): string[] {
  const selector = role === 'button' ? 'button, [role="button"]' : `[role="${role}"]`;
  return Array.from(container.querySelectorAll<HTMLElement>(selector))
    .filter((item) => item.tabIndex === 0)
    .map(
      (item) =>
        item.getAttribute('aria-label') ??
        (item.id ? container.querySelector(`label[for="${item.id}"]`)?.textContent : null) ??
        item.textContent?.trim() ??
        ''
    );
}

describe('the selected item is the only tab stop', () => {
  it('RadioGroup (controlled): the checked radio at mount and after a value change', async () => {
    const view = render(RadioGroupHarness, { props: { value: 'express' } });
    await waitFor(() => expect(tabStops(view.container, 'radio')).toEqual(['Express']));
    await view.rerender({ value: 'drone' });
    await waitFor(() => expect(tabStops(view.container, 'radio')).toEqual(['Drone']));
  });

  it('RadioGroup: the first enabled radio when nothing is checked', async () => {
    const view = render(RadioGroupHarness, { props: { value: '' } });
    await waitFor(() => expect(tabStops(view.container, 'radio')).toEqual(['Standard']));
  });

  it('Tabs (controlled): the selected tab at mount and after a value change', async () => {
    const view = render(TabsHarness, { props: { value: 'security' } });
    await waitFor(() => expect(tabStops(view.container, 'tab')).toEqual(['Security']));
    await view.rerender({ value: 'team' });
    await waitFor(() => expect(tabStops(view.container, 'tab')).toEqual(['Team']));
  });

  it('ToggleGroup single (value): the pressed item at mount and after a value change', async () => {
    const view = render(ToggleGroupFixture, { props: { value: 'center' } });
    await waitFor(() => expect(tabStops(view.container, 'button')).toEqual(['Center']));
    await view.rerender({ value: 'right' });
    await waitFor(() => expect(tabStops(view.container, 'button')).toEqual(['Right']));
  });

  it('uncontrolled RadioGroup, Tabs and ToggleGroup start on their value and follow clicks', async () => {
    const view = render(RovingSelectedFixture);
    const radios = () => tabStops(view.container, 'radio');
    const tabs = () => tabStops(view.container, 'tab');
    const toggles = () =>
      tabStops(view.container, 'button').filter((name) =>
        ['Left', 'Center', 'Right'].includes(name)
      );
    await waitFor(() => {
      expect(radios()).toEqual(['team']);
      expect(tabs()).toEqual(['Section B']);
      expect(toggles()).toEqual(['Center']);
    });
    await fireEvent.click(view.getByRole('radio', { name: 'business' }));
    await fireEvent.click(view.getByRole('tab', { name: 'Section C' }));
    await fireEvent.click(view.getByRole('button', { name: 'Right' }));
    // Focus leaves the widgets, so only the selection decides.
    view.getByRole('button', { name: 'Before' }).focus();
    await waitFor(() => {
      expect(radios()).toEqual(['business']);
      expect(tabs()).toEqual(['Section C']);
      expect(toggles()).toEqual(['Right']);
    });
  });
});
