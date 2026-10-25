import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import { HOST_REGION_ID, isHostRegionName } from '../src/region-manifests.ts';
import HostRegionHarness from './HostRegionHarness.svelte';

/**
 * Host-owned regions (player design R21, audit G18; Task 62): a `host-region`
 * node reserves a named place, the host mounts its own component there with
 * no blueprint data, and a name the host does not provide paints the label.
 */

const region = (name: string, label = 'Payment details') => ({
  id: HOST_REGION_ID,
  props: { name, label },
});
const checkout = (...children: object[]) => ({
  id: 'layout-page',
  props: { title: 'Checkout' },
  children: [{ id: 'layout-card', props: { title: 'Order summary' } }, ...children],
});

describe('host-region manifest', () => {
  it('is in the player catalog for both tiers', () => {
    const catalog = createPlayerCatalog();
    expect(catalog.get(HOST_REGION_ID)?.props.map((p) => p.name)).toEqual(['name', 'label']);
    expect(catalog.allows?.(HOST_REGION_ID, 'untrusted')).toBe(true);
    expect(catalog.allows?.(HOST_REGION_ID, 'developer')).toBe(true);
  });

  it.each(['payment', 'sign-in', 'a1'])('accepts the region name %s', (name) => {
    expect(isHostRegionName(name)).toBe(true);
  });

  it.each(['Payment', '__proto__', 'constructor!', '', '-x', 'a'.repeat(33)])(
    'refuses the region name %s',
    (name) => {
      expect(isHostRegionName(name)).toBe(false);
    }
  );
});

describe('painting host regions', () => {
  it('mounts the host snippet in a labelled group, inside an untrusted blueprint', async () => {
    const { container } = render(HostRegionHarness, {
      props: { blueprint: checkout(region('payment')) },
    });
    const group = await screen.findByRole('group', { name: 'Payment details' });
    expect(group.getAttribute('data-tx-player-host-region')).toBe('payment');
    expect(group.querySelector('[data-host-form] input[name="card"]')).not.toBeNull();
    expect(container.querySelector('[data-tx-player-host-region-missing]')).toBeNull();
  });

  it('paints the label when the host does not provide the region', async () => {
    const { container } = render(HostRegionHarness, {
      props: { blueprint: checkout(region('sign-in', 'Sign in to continue')) },
    });
    expect(await screen.findByText('Sign in to continue')).toBeTruthy();
    expect(screen.getByText('Provided by the app; not available here.')).toBeTruthy();
    expect(container.querySelector('[data-host-form]')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Sign in to continue' })).toBeNull();
  });

  it('mounts a region name once: a second node shows its label', async () => {
    const { container } = render(HostRegionHarness, {
      props: { blueprint: checkout(region('payment'), region('payment', 'Pay again')) },
    });
    await screen.findByRole('group', { name: 'Payment details' });
    expect(container.querySelectorAll('[data-host-form]')).toHaveLength(1);
    expect(screen.getByText('Pay again')).toBeTruthy();
    expect(screen.getByText('Already shown above.')).toBeTruthy();
  });

  it('never mounts a host snippet for a name outside the region pattern', async () => {
    const { container } = render(HostRegionHarness, {
      props: {
        blueprint: checkout(region('Payment', 'Odd name')),
        provide: ['payment', 'Payment'],
      },
    });
    expect(await screen.findByText('Odd name')).toBeTruthy();
    expect(container.querySelector('[data-host-hostile]')).toBeNull();
    expect(container.querySelector('[data-host-form]')).toBeNull();
  });

  it('lets a form the host mounted in its region submit, unlike painted content', async () => {
    const { container } = render(HostRegionHarness, {
      props: { blueprint: checkout(region('payment')) },
    });
    await screen.findByRole('group', { name: 'Payment details' });
    const form = container.querySelector<HTMLFormElement>('[data-host-form]') as HTMLFormElement;
    const hostSubmit = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(hostSubmit);
    expect(hostSubmit.defaultPrevented).toBe(false);

    // A form outside a host region is still cancelled at the surface (D14).
    const painted = document.createElement('form');
    const card = container.querySelector('[data-tx-player-host-region]')?.parentElement;
    card?.parentElement?.append(painted);
    const paintedSubmit = new Event('submit', { bubbles: true, cancelable: true });
    painted.dispatchEvent(paintedSubmit);
    expect(paintedSubmit.defaultPrevented).toBe(true);
    painted.remove();
  });
});
