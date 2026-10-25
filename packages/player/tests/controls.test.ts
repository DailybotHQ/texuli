import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { validateCatalogManifests } from '@texuli/catalog/manifest';
import type { RenderCatalog } from '@texuli/catalog/render/renderer';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import { CONTROL_MANIFESTS, CONTROL_STATE_TYPES } from '../src/control-manifests.ts';
import { PLAYER_GRAMMAR_ROLES } from '../src/layout-manifests.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import { mountPlayer } from '../src/mount.ts';
import Player from '../src/Player.svelte';
import { LOCAL_STATE_FORMAT } from '../src/state/bind.ts';
import { checkControlBindings } from '../src/state/controls.ts';

const state = {
  details: { type: 'boolean' },
  week: { type: 'enum', values: ['w41', 'w42', 'w43'], initial: 'w42' },
  limit: { type: 'number', min: 0, max: 10, initial: 5 },
  query: { type: 'string', maxLength: 20 },
};

function wrapped(children: unknown[], declarations: unknown = state) {
  return {
    format: LOCAL_STATE_FORMAT,
    version: 1,
    state: declarations,
    blueprint: {
      id: 'layout-page',
      props: { title: { $state: 'week' }, description: { $state: 'query' } },
      children,
    },
  };
}

const controls = [
  { id: 'control-toggle', props: { state: 'details', label: 'Show details' } },
  { id: 'control-choice', props: { state: 'week', label: 'Week' } },
  { id: 'control-slider', props: { state: 'limit', label: 'Items shown', step: 1 } },
  {
    id: 'control-filter',
    props: { state: 'query', label: 'Filter tickets', placeholder: 'Search' },
  },
];

async function mount(children: unknown[] = controls, extra: Record<string, unknown> = {}) {
  const onStateChange = vi.fn();
  const target = document.createElement('div');
  document.body.append(target);
  const mounted = mountPlayer(target, {
    blueprint: wrapped(children),
    loaders: PLAYER_LOADERS,
    onStateChange,
    ...extra,
  });
  await screen.findByRole('heading', { level: 1, name: 'w42' }, { timeout: 5000 });
  await waitFor(() => expect(target.querySelector('[data-tx-player-skeleton]')).toBeNull(), {
    timeout: 5000,
  });
  await tick();
  return { target, mounted, onStateChange };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('state-only control manifests (G06, D14)', () => {
  it('are valid, agent-emittable and interactive in the grammar', () => {
    expect(validateCatalogManifests(CONTROL_MANIFESTS)).toMatchObject({ valid: true });
    const catalog = createPlayerCatalog();
    for (const id of Object.keys(CONTROL_STATE_TYPES)) {
      expect(catalog.allows?.(id, 'untrusted')).toBe(true);
      expect(PLAYER_GRAMMAR_ROLES.get(id)?.role).toBe('interactive');
    }
  });

  it('bind only to a declared variable of the type they write', () => {
    const declarations = {
      details: { type: 'boolean', initial: false },
      week: { type: 'enum', values: ['a'], initial: 'a' },
    } as const;
    const tree = (props: Record<string, unknown>) => ({
      id: 'layout-page',
      props: {},
      children: [{ id: 'control-toggle', props }],
    });
    expect(checkControlBindings(tree({ state: 'details', label: 'x' }), declarations)).toEqual([]);
    expect(
      checkControlBindings(tree({ state: 'week', label: 'x' }), declarations)[0]?.message
    ).toContain('writes a boolean');
    expect(checkControlBindings(tree({ state: 'nope', label: 'x' }), declarations)[0]?.code).toBe(
      'control-binding'
    );
    expect(checkControlBindings(tree({ label: 'x' }), declarations)).toHaveLength(1);
    expect(
      checkControlBindings(tree({ state: 'details', label: 'x' }), null)[0]?.message
    ).toContain('declares none');
  });
});

describe('controls write state and nothing else', () => {
  it('toggle flips its boolean and raises a state event', async () => {
    const { onStateChange } = await mount();
    const toggle = screen.getByRole('switch', { name: 'Show details' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.getAttribute('type')).toBe('button');
    await fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ details: true }));
  });

  it('choice is a roving radio group that sets its enum, and bound content follows', async () => {
    const { onStateChange } = await mount();
    const group = screen.getByRole('radiogroup', { name: 'Week' });
    const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
    expect(radios.map((radio) => radio.textContent?.trim())).toEqual(['w41', 'w42', 'w43']);
    expect(radios.map((radio) => radio.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    await fireEvent.click(radios[0] as HTMLElement);
    expect(await screen.findByRole('heading', { level: 1, name: 'w41' })).toBeTruthy();
    radios[0]?.focus();
    await fireEvent.keyDown(radios[0] as HTMLElement, {
      key: 'End',
      bubbles: true,
      cancelable: true,
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'w43' })).toBeTruthy();
    await fireEvent.keyDown(group.querySelector('[aria-checked="true"]') as HTMLElement, {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'w41' })).toBeTruthy();
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ week: 'w41' }));
  });

  it('slider keeps to its declared range and filter to its declared length', async () => {
    const { mounted } = await mount();
    const slider = screen.getByRole('slider', { name: 'Items shown' }) as HTMLInputElement;
    expect([slider.min, slider.max, slider.value]).toEqual(['0', '10', '5']);
    await fireEvent.input(slider, { target: { value: '8' } });
    expect(mounted.getState().limit).toBe(8);
    const filter = screen.getByRole('searchbox', { name: 'Filter tickets' }) as HTMLInputElement;
    expect(filter.maxLength).toBe(20);
    await fireEvent.input(filter, { target: { value: 'billing' } });
    expect(mounted.getState().query).toBe('billing');
    expect(await screen.findByText('billing')).toBeTruthy();
  });

  it('works at the untrusted tier, the default for agent output', async () => {
    const { target } = await mount(controls, { tier: 'untrusted' });
    expect(target.querySelectorAll('[data-tx-player-control]')).toHaveLength(4);
    expect(target.querySelector('[role="alert"]')).toBeNull();
  });
});

describe('no submits (D14)', () => {
  it('never submits a host form around the player, by click or by Enter', async () => {
    const hostForm = document.createElement('form');
    const submitted = vi.fn((event: Event) => event.preventDefault());
    hostForm.addEventListener('submit', submitted);
    document.body.append(hostForm);
    const view = render(Player, {
      target: hostForm,
      props: { blueprint: wrapped(controls), loaders: PLAYER_LOADERS },
    });
    await screen.findByRole('heading', { level: 1, name: 'w42' }, { timeout: 5000 });
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-tx-player-control]')).toHaveLength(4)
    );
    for (const button of view.container.querySelectorAll('[data-tx-player-control] button')) {
      expect(button.getAttribute('type')).toBe('button');
    }
    await fireEvent.click(screen.getByRole('switch', { name: 'Show details' }));
    const filter = screen.getByRole('searchbox', { name: 'Filter tickets' });
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    filter.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    // A submit raised from inside the painted surface is cancelled there.
    const surface = view.container.querySelector('[data-tx-player-surface]') as HTMLElement;
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    surface.querySelector('[data-tx-player-control]')?.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
    expect(submitted).not.toHaveBeenCalled();
  });

  it('cancels a submit from a form inside any painted component', async () => {
    const base = createPlayerCatalog();
    const catalog: RenderCatalog = {
      get: (id) =>
        id === 'test-form' ? { id, label: 'Form', props: [], emit: ['developer'] } : base.get(id),
      allows: (id, tier) => (id === 'test-form' ? true : (base.allows?.(id, tier) ?? false)),
    };
    const outer = vi.fn();
    document.addEventListener('submit', outer);
    const view = render(Player, {
      props: {
        blueprint: {
          id: 'layout-page',
          props: { title: 'Forms' },
          children: [{ id: 'test-form', props: {} }],
        },
        catalog,
        tier: 'developer',
        loaders: {
          ...PLAYER_LOADERS,
          'test-form': async () => (await import('./FormStub.svelte')).default,
        },
      },
    });
    const form = await screen.findByTestId('painted-form', {}, { timeout: 5000 });
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
    expect(outer).not.toHaveBeenCalled();
    document.removeEventListener('submit', outer);
    view.unmount();
  });
});

describe('refusals', () => {
  it('refuses a control without declared state, and one bound to the wrong type', async () => {
    const plain = render(Player, {
      props: {
        blueprint: { id: 'layout-page', props: { title: 'Plain' }, children: [controls[0]] },
        loaders: PLAYER_LOADERS,
      },
    });
    expect(plain.container.querySelector('[data-tx-player-state-notice]')?.textContent).toContain(
      'declares none'
    );
    plain.unmount();
    const mismatched = render(Player, {
      props: {
        blueprint: wrapped([{ id: 'control-slider', props: { state: 'week', label: 'Wrong' } }]),
        loaders: PLAYER_LOADERS,
      },
    });
    expect(
      mismatched.container.querySelector('[data-tx-player-state-notice]')?.textContent
    ).toContain('writes a number');
  });
});
