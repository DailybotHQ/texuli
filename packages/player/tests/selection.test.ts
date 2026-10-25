import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { RenderCatalog } from '@texuli/catalog/render/renderer';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import Player from '../src/Player.svelte';
import { applySelection, EMPTY_SELECTION, pruneSelection } from '../src/selection.ts';

const layoutLoader = async () =>
  import('../src/layouts/ContentLayout.svelte').then((m) => m.default);
const focusStub = async () => import('./FocusStub.svelte').then((m) => m.default);

function catalogWithButton(): RenderCatalog {
  const base = createPlayerCatalog();
  const spec = {
    id: 'test-button',
    label: 'Test button',
    props: [{ name: 'label', kind: 'string' as const }],
    emit: ['developer'] as const,
  };
  return {
    get: (id) => (id === 'test-button' ? spec : base.get(id)),
    allows: (id, tier) => (id === 'test-button' ? true : (base.allows?.(id, tier) ?? false)),
  };
}

const loaders = {
  'layout-page': layoutLoader,
  'layout-card': layoutLoader,
  'layout-grid': layoutLoader,
  'test-button': focusStub,
};
const card = (title: string, children: unknown[] = []) => ({
  id: 'layout-card',
  props: { title },
  children,
});

/** page > [card A > [A1, A2], grid > [G1, G2], card B > button] */
const tree = {
  id: 'layout-page',
  props: { title: 'Selection page' },
  children: [
    card('A', [card('A1'), card('A2')]),
    { id: 'layout-grid', props: { columns: 2 }, children: [card('G1'), card('G2')] },
    card('B', [{ id: 'test-button', props: { label: 'Act' } }]),
  ],
};
const PATH = {
  page: '0',
  A: '0.children.0',
  A1: '0.children.0.children.0',
  grid: '0.children.1',
  G1: '0.children.1.children.0',
  B: '0.children.2',
};

async function paint(extra: Record<string, unknown> = {}) {
  const onSelectionChange = vi.fn();
  const view = render(Player, {
    props: {
      blueprint: tree,
      catalog: catalogWithButton(),
      tier: 'developer',
      loaders,
      selectable: true,
      onSelectionChange,
      ...extra,
    },
  });
  await waitFor(
    () => {
      expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull();
      expect(screen.getByRole('button', { name: 'Act', hidden: true })).toBeTruthy();
    },
    { timeout: 5000 }
  );
  await tick();
  const frame = (path: string) =>
    view.container.querySelector<HTMLElement>(`[data-tx-player-path="${path}"]`) as HTMLElement;
  const selected = () =>
    Array.from(view.container.querySelectorAll('[data-tx-player-selected]')).map((element) =>
      element.getAttribute('data-tx-player-path')
    );
  return { ...view, frame, selected, onSelectionChange };
}

function key(target: Element, name: string, init: KeyboardEventInit = {}) {
  return fireEvent.keyDown(target, { key: name, bubbles: true, cancelable: true, ...init });
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('selection model', () => {
  const siblings = [PATH.A, PATH.grid, PATH.B];

  it('replaces, toggles and ranges among siblings', () => {
    const one = applySelection(EMPTY_SELECTION, PATH.A, 'replace', siblings);
    expect(one).toEqual({ selected: [PATH.A], anchor: PATH.A });
    expect(applySelection(one, PATH.B, 'range', siblings).selected).toEqual(siblings);
    const toggled = applySelection(one, PATH.B, 'toggle', siblings);
    expect(toggled.selected).toEqual([PATH.A, PATH.B]);
    expect(applySelection(toggled, PATH.A, 'toggle', siblings).selected).toEqual([PATH.B]);
  });

  it('never ranges across levels: an anchor outside the siblings starts fresh', () => {
    const anchored = applySelection(EMPTY_SELECTION, PATH.A1, 'replace', [PATH.A1]);
    expect(applySelection(anchored, PATH.B, 'range', siblings)).toEqual({
      selected: [PATH.B],
      anchor: PATH.B,
    });
  });

  it('prunes paths that are no longer frames, keeping the state object when nothing changes', () => {
    const state = { selected: [PATH.A, PATH.B], anchor: PATH.B };
    expect(pruneSelection(state, new Set([PATH.A, PATH.B]))).toBe(state);
    expect(pruneSelection(state, new Set([PATH.A]))).toEqual({ selected: [PATH.A], anchor: null });
  });
});

describe('selecting painted frames', () => {
  it('is off by default: clicks select nothing and report nothing', async () => {
    const { frame, selected, onSelectionChange, container } = await paint({ selectable: false });
    await fireEvent.click(frame(PATH.A));
    expect(selected()).toEqual([]);
    expect(onSelectionChange).not.toHaveBeenCalled();
    // The one announcer says only the paint result, never a selection.
    expect(container.querySelector('[data-tx-player-announcer]')?.textContent).not.toContain(
      'selected'
    );
  });

  it('click selects one frame, visibly and announced; another click replaces it', async () => {
    const { frame, selected, onSelectionChange, container } = await paint();
    await fireEvent.click(frame(PATH.A));
    expect(selected()).toEqual([PATH.A]);
    expect(onSelectionChange).toHaveBeenLastCalledWith([PATH.A]);
    const announcer = () =>
      container.querySelector('[data-tx-player-announcer]')?.textContent?.trim();
    expect(announcer()).toBe('A selected');
    await fireEvent.click(frame(PATH.B));
    expect(selected()).toEqual([PATH.B]);
    expect(announcer()).toBe('B selected');
    await fireEvent.click(frame(PATH.A), { ctrlKey: true });
    expect(announcer()).toBe('2 selected');
  });

  it('Ctrl or Cmd click toggles; Shift click selects a sibling range, never across levels', async () => {
    const { frame, selected } = await paint();
    await fireEvent.click(frame(PATH.A));
    await fireEvent.click(frame(PATH.B), { ctrlKey: true });
    expect(selected()).toEqual([PATH.A, PATH.B]);
    await fireEvent.click(frame(PATH.A), { metaKey: true });
    expect(selected()).toEqual([PATH.B]);
    await fireEvent.click(frame(PATH.A));
    await fireEvent.click(frame(PATH.B), { shiftKey: true });
    expect(selected()).toEqual([PATH.A, PATH.grid, PATH.B]);
    await fireEvent.click(frame(PATH.A1), { shiftKey: true });
    expect(selected()).toEqual([PATH.A1]);
  });

  it('never hijacks a control inside a painted component', async () => {
    const { selected, onSelectionChange } = await paint();
    const act = screen.getByRole('button', { name: 'Act' });
    const clicked = vi.fn();
    act.addEventListener('click', clicked);
    await fireEvent.click(act);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(selected()).toEqual([]);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});

describe('keyboard selection, consistent with frame roving', () => {
  it('Space selects, Shift+Arrow extends among siblings, Escape clears before walking out', async () => {
    const { frame, selected, container } = await paint();
    frame(PATH.A).focus();
    await key(frame(PATH.A), ' ');
    expect(selected()).toEqual([PATH.A]);
    await key(frame(PATH.A), 'ArrowDown', { shiftKey: true });
    expect(document.activeElement).toBe(frame(PATH.grid));
    expect(selected()).toEqual([PATH.A, PATH.grid]);
    await key(frame(PATH.grid), 'ArrowDown', { shiftKey: true });
    expect(selected()).toEqual([PATH.A, PATH.grid, PATH.B]);
    await key(frame(PATH.B), 'Escape');
    expect(selected()).toEqual([]);
    expect(document.activeElement).toBe(frame(PATH.B));
    await key(frame(PATH.B), 'Escape');
    expect(document.activeElement).toBe(container.querySelector('.tx-player__label'));
  });

  it('plain arrows still rove without selecting; Ctrl+Space toggles', async () => {
    const { frame, selected } = await paint();
    frame(PATH.A).focus();
    await key(frame(PATH.A), 'ArrowDown');
    expect(document.activeElement).toBe(frame(PATH.grid));
    expect(selected()).toEqual([]);
    await key(frame(PATH.grid), ' ', { ctrlKey: true });
    await key(frame(PATH.grid), 'ArrowDown');
    await key(frame(PATH.B), ' ', { ctrlKey: true });
    expect(selected()).toEqual([PATH.grid, PATH.B]);
  });
});

describe('containment', () => {
  it('skips inert frames in ranges and ignores clicks inside them', async () => {
    const { frame, selected } = await paint();
    frame(PATH.grid).setAttribute('inert', '');
    await fireEvent.click(frame(PATH.G1));
    expect(selected()).toEqual([]);
    await fireEvent.click(frame(PATH.A));
    await fireEvent.click(frame(PATH.B), { shiftKey: true });
    expect(selected()).toEqual([PATH.A, PATH.B]);
  });

  it('an inactive player takes no selection', async () => {
    const { frame, selected, onSelectionChange } = await paint({ active: false });
    await fireEvent.click(frame(PATH.A));
    expect(selected()).toEqual([]);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});

describe('host control and side effects', () => {
  it('paints the host selection and drops paths that are not frames', async () => {
    const { selected, onSelectionChange } = await paint({
      selection: [PATH.grid, '0.children.9', PATH.B],
    });
    expect(selected()).toEqual([PATH.grid, PATH.B]);
    expect(onSelectionChange).toHaveBeenLastCalledWith([PATH.grid, PATH.B]);
  });

  it('selection is state only: no state change, re-validation, network or intent', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const onStateChange = vi.fn();
    const onDiagnostics = vi.fn();
    const { frame } = await paint({ onStateChange, onDiagnostics });
    expect(onDiagnostics).toHaveBeenCalledTimes(1);
    await fireEvent.click(frame(PATH.A));
    await fireEvent.click(frame(PATH.B), { shiftKey: true });
    frame(PATH.B).focus();
    await key(frame(PATH.B), 'Escape');
    expect(onStateChange).not.toHaveBeenCalled();
    expect(onDiagnostics).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
