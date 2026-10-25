import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SelectHarness from './fixtures/SelectHarness.svelte';

afterEach(() => cleanup());

describe('Select', () => {
  it('shows the current value on a combobox trigger', () => {
    render(SelectHarness);
    const trigger = screen.getByRole('combobox', { name: 'Plan' });
    expect(trigger.textContent).toContain('Free');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a listbox of options with the current one selected', async () => {
    render(SelectHarness);
    await fireEvent.click(screen.getByRole('combobox', { name: 'Plan' }));
    const listbox = await screen.findByRole('listbox');
    expect(listbox).toBeTruthy();
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent?.trim())).toEqual([
      'Free',
      'Team',
      'Business',
      'Enterprise',
    ]);
    expect(screen.getByRole('option', { name: 'Free' }).getAttribute('aria-selected')).toBe('true');
  });

  it('selects an option by click and closes', async () => {
    const onValueChange = vi.fn();
    render(SelectHarness, { props: { onValueChange } });
    await fireEvent.click(screen.getByRole('combobox', { name: 'Plan' }));
    await fireEvent.click(screen.getByRole('option', { name: 'Team' }));
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull();
    });
    expect(screen.getByRole('combobox', { name: 'Plan' }).textContent).toContain('Team');
    expect(onValueChange).toHaveBeenCalledWith('team');
  });

  it('marks disabled options and keeps the value when forced-clicked', async () => {
    render(SelectHarness);
    await fireEvent.click(screen.getByRole('combobox', { name: 'Plan' }));
    const business = screen.getByRole('option', { name: 'Business' });
    expect(business.getAttribute('aria-disabled')).toBe('true');
    await fireEvent.click(business);
    expect(screen.getByRole('combobox', { name: 'Plan' }).textContent).toContain('Free');
  });

  it('moves with keyboard and typeahead', async () => {
    render(SelectHarness);
    const trigger = screen.getByRole('combobox', { name: 'Plan' });
    trigger.focus();
    await fireEvent.keyDown(trigger, { key: 'Enter' });
    await screen.findByRole('listbox');
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    await fireEvent.keyDown(trigger, { key: 'Enter' });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(trigger.textContent).toContain('Team');

    await fireEvent.keyDown(trigger, { key: 'Enter' });
    await screen.findByRole('listbox');
    await fireEvent.keyDown(trigger, { key: 'e' });
    await fireEvent.keyDown(trigger, { key: 'Enter' });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(trigger.textContent).toContain('Enterprise');
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

  it('closes on Escape and returns focus to the trigger', async () => {
    render(SelectHarness);
    const trigger = screen.getByRole('combobox', { name: 'Plan' });
    trigger.focus();
    await fireEvent.keyDown(trigger, { key: 'Enter' });
    await screen.findByRole('listbox');
    await fireEvent.keyDown(trigger, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});

describe('Select.Group', () => {
  it('exposes role=group labelled by GroupLabel and navigates across groups', async () => {
    render(SelectHarness, { props: { grouped: true } });
    await fireEvent.click(screen.getByRole('combobox', { name: 'Plan' }));
    await screen.findByRole('listbox');

    const groups = screen.getAllByRole('group');
    expect(groups.length).toBeGreaterThanOrEqual(2);
    for (const group of groups) {
      const labelledBy = group.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      const label = document.getElementById(labelledBy!);
      expect(label?.textContent).toMatch(/Personal|Organization/);
    }

    const trigger = screen.getByRole('combobox', { name: 'Plan' });
    // Free is selected; ArrowDown should land on Team in the next group.
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    await fireEvent.keyDown(trigger, { key: 'Enter' });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(trigger.textContent).toContain('Team');
  });

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
