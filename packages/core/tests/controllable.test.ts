// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createControllableState } from '../src/index.ts';

describe('createControllableState', () => {
  it('starts uncontrolled state from its default and updates it, and 3 related cases', () => {
    {
      // starts uncontrolled state from its default and updates it
      const onChange = vi.fn();
      const state = createControllableState({ defaultValue: 'closed', onChange });

      expect(state.value).toBe('closed');
      state.setValue('open');

      expect(state.value).toBe('open');
      expect(onChange).toHaveBeenCalledExactlyOnceWith('open');
    }
    {
      // ignores equal values and uses Object.is for equality
      const onChange = vi.fn();
      const state = createControllableState({ defaultValue: Number.NaN, onChange });

      state.setValue(Number.NaN);
      expect(onChange).not.toHaveBeenCalled();
      state.setValue(0);
      expect(onChange).toHaveBeenCalledExactlyOnceWith(0);
    }
    {
      // updates from the latest value and supports function-valued state
      const onChange = vi.fn();
      const fn = () => 'value';
      const state = createControllableState<(() => string) | null>({
        defaultValue: null,
        onChange,
      });

      state.setValue(fn);
      expect(state.value).toBe(fn);
      state.update((current) => (current === fn ? null : fn));

      expect(state.value).toBeNull();
      expect(onChange.mock.calls).toEqual([[fn], [null]]);
    }
    {
      // reads a controlled value dynamically and only requests changes
      let ownerValue = 'first';
      const onChange = vi.fn((next: string) => {
        ownerValue = next;
      });
      const state = createControllableState({
        value: () => ownerValue,
        defaultValue: 'unused',
        onChange,
      });

      expect(state.value).toBe('first');
      state.setValue('first');
      state.update((current) => `${current}-next`);

      expect(onChange).toHaveBeenCalledExactlyOnceWith('first-next');
      expect(state.value).toBe('first-next');
    }
  });
  it('does not mutate controlled state when the owner does not accept a request, and 2 related cases', () => {
    {
      // does not mutate controlled state when the owner does not accept a request
      const onChange = vi.fn();
      const state = createControllableState({
        value: () => 'owner',
        defaultValue: 'unused',
        onChange,
      });

      state.setValue('requested');

      expect(onChange).toHaveBeenCalledExactlyOnceWith('requested');
      expect(state.value).toBe('owner');
    }
    {
      // allows undefined as a controlled value
      const state = createControllableState<string | undefined>({
        value: () => undefined,
        defaultValue: 'unused',
      });

      expect(state.value).toBeUndefined();
    }
    {
      // calls change-complete only when the caller signals completion
      const onChange = vi.fn();
      const onChangeComplete = vi.fn();
      const state = createControllableState({ defaultValue: 1, onChange, onChangeComplete });

      state.setValue(2);
      expect(onChange).toHaveBeenCalledExactlyOnceWith(2);
      expect(onChangeComplete).not.toHaveBeenCalled();

      state.complete();
      expect(onChangeComplete).toHaveBeenCalledExactlyOnceWith(2);
      expect(onChange).toHaveBeenCalledExactlyOnceWith(2);
    }
  });
});
