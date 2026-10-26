/**
 * T-88 (routed from the T-90 screen-reader pass): the agent playground's
 * accessible names and statuses say what is true.
 *
 * - On load the pressed preset has already run, so the preview never claims
 *   "every node was dropped" for a tree nobody rendered yet; a reset or a new
 *   preset says "not rendered yet" instead.
 * - Each preset button is named by its title alone; the group tag and the
 *   caption are its description, so the name stays short.
 * - The Validation status is one persistent live region whose text changes
 *   (it is never swapped for a list), so the change is announced.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import PlaygroundApp from '../src/components/playground/PlaygroundApp.svelte';
import { PLAYGROUND_PRESETS } from '../src/components/playground/presets.ts';

afterEach(() => {
  cleanup();
});

function validation(): HTMLElement {
  return screen.getByRole('region', { name: 'Validation' });
}

describe('playground preview status', () => {
  it('runs the pressed preset on load instead of reporting a dropped tree', () => {
    const { container } = render(PlaygroundApp);
    expect(screen.queryByText(/every node was dropped/)).toBeNull();
    expect(container.querySelector('[data-tx-playground-tree]')).not.toBeNull();
    expect(within(validation()).getByRole('status').textContent).toMatch(/No diagnostics/);
  });

  it('says the tree is not rendered yet after a reset, not that it was dropped', async () => {
    render(PlaygroundApp);
    await fireEvent.click(screen.getByRole('button', { name: 'Reset preset' }));
    expect(screen.queryByText(/every node was dropped/)).toBeNull();
    expect(screen.getByText(/Not rendered yet/)).toBeTruthy();
  });
});

describe('playground preset buttons', () => {
  it('are named by their title and described by their tag and caption', () => {
    render(PlaygroundApp);
    const group = screen.getByRole('group', { name: 'Presets' });
    for (const preset of PLAYGROUND_PRESETS) {
      const button = within(group).getByRole('button', { name: preset.label });
      // The visible text inside the button is the title alone (axe label-content-name-mismatch).
      expect(button.textContent?.trim()).toBe(preset.label);
      expect(button.getAttribute('aria-describedby')).toBeTruthy();
      const description = (button.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent?.trim())
        .join(' ');
      expect(description).toContain(preset.proves);
    }
  });
});

describe('playground validation live region', () => {
  it('keeps one status element and states the diagnostics count in it', async () => {
    render(PlaygroundApp);
    const status = within(validation()).getByRole('status');
    const hostile = PLAYGROUND_PRESETS.find((preset) => preset.id.startsWith('hostile-'));
    expect(hostile).toBeTruthy();
    // Pick hostile presets until one reports diagnostics.
    let reported = false;
    for (const preset of PLAYGROUND_PRESETS.filter((p) => p.id.startsWith('hostile-'))) {
      await fireEvent.click(
        within(screen.getByRole('group', { name: 'Presets' })).getByRole('button', {
          name: preset.label,
        })
      );
      if (validation().querySelector('[data-tx-playground-diagnostics]')) {
        reported = true;
        break;
      }
    }
    expect(reported).toBe(true);
    expect(status.isConnected).toBe(true);
    expect(within(validation()).getByRole('status')).toBe(status);
    expect(status.textContent).toMatch(/\d+ diagnostics?/);
  });
});
