import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFormBridge } from '../src/index.ts';

describe('createFormBridge', () => {
  const bridges: Array<ReturnType<typeof createFormBridge>> = [];

  afterEach(() => {
    for (const bridge of bridges.splice(0)) bridge.dispose();
  });
  it('creates a hidden native text control with submission and validation attributes, and 3 related cases', async () => {
    {
      // creates a hidden native text control with submission and validation attributes
      const form = document.createElement('form');
      form.id = 'settings';
      document.body.append(form);
      const focusTarget = document.createElement('button');
      const bridge = createFormBridge(document, {
        name: 'timezone',
        value: 'UTC',
        defaultValue: 'Etc/UTC',
        required: true,
        form: 'settings',
        focusTarget,
      });
      bridges.push(bridge);
      document.body.append(bridge.input);

      expect(bridge.input.type).toBe('text');
      expect(bridge.input.name).toBe('timezone');
      expect(bridge.input.value).toBe('UTC');
      expect(bridge.input.defaultValue).toBe('Etc/UTC');
      expect(bridge.input.required).toBe(true);
      expect(bridge.input.form).toBe(form);
      expect(bridge.input.tabIndex).toBe(-1);
      expect(bridge.input.getAttribute('aria-hidden')).toBe('true');
      expect(bridge.input.style.clipPath).toBe('inset(50%)');
      expect(new FormData(form).get('timezone')).toBe('UTC');

      bridge.setValue('');
      expect(bridge.input.checkValidity()).toBe(false);
      bridge.setValue('America/Bogota');
      expect(bridge.input.checkValidity()).toBe(true);
      expect(new FormData(form).get('timezone')).toBe('America/Bogota');
    }
    for (const bridge of bridges.splice(0)) bridge.dispose();
    {
      // supports disabled fields and custom validity messages
      const form = document.createElement('form');
      const focusTarget = document.createElement('button');
      const bridge = createFormBridge(document, {
        name: 'account',
        value: 'team-1',
        disabled: true,
        focusTarget,
      });
      bridges.push(bridge);
      form.append(bridge.input);
      expect(new FormData(form).has('account')).toBe(false);
      expect(bridge.input.checkValidity()).toBe(true);

      bridge.input.disabled = false;
      bridge.setValidity('This account is unavailable.');
      expect(bridge.input.validationMessage).toBe('This account is unavailable.');
      expect(bridge.input.checkValidity()).toBe(false);
      bridge.setValidity('');
      expect(bridge.input.checkValidity()).toBe(true);
    }
    for (const bridge of bridges.splice(0)) bridge.dispose();
    // restores the default value on form reset and notifies the custom control
    await (async () => {
      const form = document.createElement('form');
      document.body.append(form);
      const onReset = vi.fn();
      const focusTarget = document.createElement('button');
      const bridge = createFormBridge(document, {
        name: 'displayName',
        value: 'Changed',
        defaultValue: 'Initial',
        onReset,
        focusTarget,
      });
      bridges.push(bridge);
      form.append(bridge.input);

      form.reset();
      await Promise.resolve();
      expect(bridge.input.value).toBe('Initial');
      expect(onReset).toHaveBeenCalledWith('Initial');
    })();
    for (const bridge of bridges.splice(0)) bridge.dispose();
    // does not notify when another listener cancels the form reset
    await (async () => {
      const form = document.createElement('form');
      document.body.append(form);
      const onReset = vi.fn();
      const focusTarget = document.createElement('button');
      const bridge = createFormBridge(document, { name: 'item', value: 'A', onReset, focusTarget });
      bridges.push(bridge);
      form.append(bridge.input);
      form.addEventListener('reset', (event) => event.preventDefault());

      form.reset();
      await Promise.resolve();
      expect(bridge.input.value).toBe('A');
      expect(onReset).not.toHaveBeenCalled();
    })();
  });

  it('focuses the visible custom control on invalid input and disposes safely', async () => {
    const focusTarget = document.createElement('button');
    const focus = vi.spyOn(focusTarget, 'focus');
    const bridge = createFormBridge(document, {
      name: 'requiredChoice',
      required: true,
      focusTarget,
    });
    bridges.push(bridge);
    document.body.append(bridge.input, focusTarget);

    expect(bridge.input.reportValidity()).toBe(false);
    await Promise.resolve();
    expect(focus).toHaveBeenCalledOnce();
    bridge.dispose();
    bridge.dispose();
    expect(bridge.input.isConnected).toBe(false);
  });
});
