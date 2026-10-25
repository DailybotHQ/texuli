import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SwitchFixture from './switch-fixture.svelte';
import UncontrolledFixture from './switch-uncontrolled-fixture.svelte';

afterEach(() => cleanup());

describe('Switch', () => {
  it('exposes role=switch named by its label and starts unchecked', () => {
    const { getByRole } = render(SwitchFixture);
    const control = getByRole('switch', { name: 'Airplane mode' });
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(control.getAttribute('data-state')).toBe('unchecked');
    expect(control.getAttribute('aria-describedby')).toBe('airplane-description');
  });

  it('toggles on click and emits onCheckedChange', async () => {
    const onCheckedChange = vi.fn();
    const { getByRole } = render(SwitchFixture, { props: { onCheckedChange } });
    const control = getByRole('switch', { name: 'Airplane mode' });
    await fireEvent.click(control);
    expect(control.getAttribute('aria-checked')).toBe('true');
    expect(control.getAttribute('data-state')).toBe('checked');
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    await fireEvent.click(control);
    expect(control.getAttribute('aria-checked')).toBe('false');
  });

  it('toggles with Space and Enter', async () => {
    const { getByRole } = render(SwitchFixture);
    const control = getByRole('switch', { name: 'Airplane mode' });
    control.focus();
    await fireEvent.keyDown(control, { key: ' ' });
    expect(control.getAttribute('aria-checked')).toBe('true');
    await fireEvent.keyDown(control, { key: 'Enter' });
    expect(control.getAttribute('aria-checked')).toBe('false');
  });

  it('toggles when its label is clicked', async () => {
    const { getByRole, getByText } = render(SwitchFixture);
    await fireEvent.click(getByText('Airplane mode'));
    expect(getByRole('switch', { name: 'Airplane mode' }).getAttribute('aria-checked')).toBe(
      'true'
    );
  });

  it('does not change when disabled', async () => {
    const { getByRole } = render(SwitchFixture);
    const locked = getByRole('switch', { name: 'Managed setting' });
    expect(locked).toHaveProperty('disabled', true);
    await fireEvent.click(locked);
    expect(locked.getAttribute('aria-checked')).toBe('false');
  });

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
