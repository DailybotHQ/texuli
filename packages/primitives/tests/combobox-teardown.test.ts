/// <reference types="node" />
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { getInertRegistry, resetInertRegistry } from '@texuli/core/inert';
import { afterEach, describe, expect, it } from 'vitest';
import ComboboxHarness from './ComboboxHarness.svelte';

afterEach(() => {
  cleanup();
  resetInertRegistry();
});

/** Collects errors that escape to the window or as unhandled rejections. */
function watchUnhandled() {
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => errors.push(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => errors.push(event.reason);
  const onProcess = (reason: unknown) => errors.push(reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  process.on('unhandledRejection', onProcess);
  process.on('uncaughtException', onProcess);
  return {
    errors,
    stop() {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      process.off('unhandledRejection', onProcess);
      process.off('uncaughtException', onProcess);
    },
  };
}

describe('@texuli/primitives/combobox teardown', () => {
  it('unmounts mid-open, inside a modal scope, without an unhandled error', async () => {
    const outside = document.body.appendChild(document.createElement('div'));
    // A modal elsewhere on the page: the list would exempt itself while open.
    const scope = getInertRegistry().inertOutside(outside);
    const watch = watchUnhandled();
    try {
      const view = render(ComboboxHarness);
      const input = screen.getByRole('combobox', { name: 'Colors' });
      // Open (the list mounts and its overlay engages), then unmount in the same tick.
      void fireEvent.input(input, { target: { value: 'ja' } });
      view.unmount();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(watch.errors).toEqual([]);
      expect(
        getInertRegistry()
          .exemptions()
          .map((entry) => entry.label)
      ).not.toContain('combobox');
    } finally {
      watch.stop();
      scope.release();
      outside.remove();
    }
  });

  it('opens and closes repeatedly inside a modal scope, releasing its exemption each time', async () => {
    const outside = document.body.appendChild(document.createElement('div'));
    const scope = getInertRegistry().inertOutside(outside);
    const view = render(ComboboxHarness);
    const input = screen.getByRole('combobox', { name: 'Colors' });
    for (let i = 0; i < 3; i += 1) {
      await fireEvent.input(input, { target: { value: 'ja' } });
      expect(screen.getByRole('listbox')).toBeTruthy();
      await fireEvent.keyDown(input, { key: 'Escape' });
    }
    view.unmount();
    expect(getInertRegistry().exemptions()).toEqual([]);
    scope.release();
    outside.remove();
  });
});
