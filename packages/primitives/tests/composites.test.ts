import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { Pagination } from '@texuli/primitives/pagination';
import { flushSync, tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attachDismissLayer,
  attachOverlay,
  attachPosition,
  attachRovingFocus,
  composeChildProps,
  createPrimitiveContext,
  stateAttributes,
} from '../src/internal/index.ts';
import ProgressRoot from '../src/progress/Progress.svelte';
import { Separator } from '../src/separator/index.ts';
import { type SplitterStorage } from '../src/splitter/index.ts';
import Fixture from './accordion-fixture.svelte';
import MissingRoot from './accordion-missing-root-fixture.svelte';
import CommandHarness from './CommandHarness.svelte';
import ContextFixture from './context-fixture.svelte';
import AvatarHarness from './fixtures/AvatarHarness.svelte';
import CollapsibleHarness from './fixtures/CollapsibleHarness.svelte';
import HandlerComposeHarness from './fixtures/HandlerComposeHarness.svelte';
import RovingSelectedFixture from './fixtures/RovingSelectedFixture.svelte';
import ScrollAreaFixture from './fixtures/ScrollAreaFixture.svelte';
import ToggleGroupFixture from './fixtures/ToggleGroupFixture.svelte';
import ListboxHarness from './ListboxHarness.svelte';
import RadioGroupHarness from './RadioGroupHarness.svelte';
import ChildFixture from './separator-child-fixture.svelte';
import SplitterFixture from './splitter-fixture.svelte';
import TabsHarness from './TabsHarness.svelte';
import ToolbarFixture from './toolbar-fixture.svelte';
import TreeFixture from './tree-fixture.svelte';

// Composite and display primitives: state, composition and prop contracts the
// behavior suite (tests/behavior) does not reach.

describe('internal', () => {
  const cleanups: Array<() => void> = [];

  function attach<E extends Element>(binding: (node: E) => unknown, node: E) {
    const cleanup = binding(node);
    if (typeof cleanup === 'function') cleanups.push(cleanup as () => void);
  }

  afterEach(() => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    document.body.replaceChildren();
  });

  describe('Svelte attachment adapters', () => {
    it('disconnects outside-focus listeners when the layer detaches', () => {
      const layer = document.createElement('div');
      const outside = document.createElement('button');
      const onFocusOutside = vi.fn();
      document.body.append(layer, outside);
      attach(attachDismissLayer({ pointerOutside: false, onFocusOutside }), layer);

      outside.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(onFocusOutside).toHaveBeenCalledTimes(1);

      cleanups.pop()?.();
      outside.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(onFocusOutside).toHaveBeenCalledTimes(1);
    });

    it('synchronizes roving items, responds to keys, and restores authored tabindex on detach', () => {
      const root = document.createElement('div');
      const first = document.createElement('button');
      const second = document.createElement('button');
      first.dataset.rovingItem = '';
      second.dataset.rovingItem = '';
      first.setAttribute('tabindex', '4');
      root.append(first, second);
      document.body.append(root);
      attach(attachRovingFocus({ orientation: 'horizontal', observe: false }), root);

      expect(first.getAttribute('tabindex')).toBe('0');
      expect(second.getAttribute('tabindex')).toBe('-1');
      first.focus();
      const move = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      root.dispatchEvent(move);
      expect(move.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(second);

      cleanups.pop()?.();
      expect(first.getAttribute('tabindex')).toBe('4');
      expect(second.hasAttribute('tabindex')).toBe(false);
      const afterDetach = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
        cancelable: true,
      });
      root.dispatchEvent(afterDetach);
      expect(afterDetach.defaultPrevented).toBe(false);
    });

    it('positions a floating node on attach and clears owned styles on detach', () => {
      const reference = document.createElement('button');
      const floating = document.createElement('div');
      document.body.append(reference, floating);
      attach(
        attachPosition(reference, {
          placement: 'bottom',
          cssAnchor: 'never',
          ancestorScroll: false,
          ancestorResize: false,
          elementResize: false,
          layoutShift: false,
        }),
        floating
      );
      expect(floating.style.position).toBe('fixed');

      cleanups.pop()?.();
      expect(floating.style.position).toBe('');
    });

    it('destroys the overlay controller when its node detaches', () => {
      const node = document.createElement('div');
      const onController = vi.fn();
      document.body.append(node);
      attach(attachOverlay({ dismiss: { escape: false } }, onController), node);

      expect(onController).toHaveBeenCalledTimes(1);
      const controller = onController.mock.calls[0]?.[0];
      expect(controller?.phase()).toBe('closed');

      cleanups.pop()?.();
      expect(controller?.phase()).toBe('closed');
      expect(onController).toHaveBeenLastCalledWith(undefined);
    });
  });

  describe('primitive composition contracts', () => {
    it('composes child classes and event handlers while allowing a child veto', () => {
      const childClick = vi.fn((event: Event) => event.preventDefault());
      const primitiveClick = vi.fn();
      const props = composeChildProps(
        {
          class: 'trigger',
          onclick: primitiveClick,
          'data-state': 'open',
          'aria-expanded': 'true',
        },
        { class: 'custom', onclick: childClick, 'data-state': 'closed', 'aria-expanded': 'false' }
      );
      const event = new Event('click', { cancelable: true });

      props.onclick?.(event);
      expect(props.class).toBe('trigger custom');
      expect(props['data-state']).toBe('open');
      expect(props['aria-expanded']).toBe('true');
      expect(childClick).toHaveBeenCalledWith(event);
      expect(primitiveClick).not.toHaveBeenCalled();

      const allowChildClick = vi.fn();
      const runPrimitiveClick = vi.fn();
      const composed = composeChildProps(
        { onclick: runPrimitiveClick },
        { onclick: allowChildClick }
      );
      const accepted = new Event('click', { cancelable: true });
      composed.onclick?.(accepted);
      expect(allowChildClick).toHaveBeenCalledWith(accepted);
      expect(runPrimitiveClick).toHaveBeenCalledWith(accepted);
    });

    it('uses consistent state attributes and reports missing context providers', () => {
      expect(stateAttributes('open')).toEqual({ 'data-state': 'open' });
      expect(stateAttributes('disabled')).toEqual({
        'data-state': 'disabled',
        'data-disabled': '',
      });
      expect(stateAttributes('closed', true)).toEqual({
        'data-state': 'closed',
        'data-disabled': '',
      });

      const menu = createPrimitiveContext<{ selected: string }>('Menu');
      expect(() => menu.get()).toThrow('Missing Menu provider');

      render(ContextFixture);
      expect(screen.getByText('alpha')).toBeTruthy();
    });
  });
});

describe('roving-selected', () => {
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
});

describe('accordion', () => {
  afterEach(cleanup);

  const trigger = (name: string) => screen.getByRole('button', { name }) as HTMLElement;
  const region = (name: string) => screen.queryByRole('region', { name });
  const press = async (key: string, target: Element = document.activeElement as Element) => {
    await fireEvent.keyDown(target, { key });
  };

  describe('Accordion: structure (APG)', () => {
    it('throws a clear error when an item has no root', () => {
      expect(() => render(MissingRoot)).toThrow('Missing Accordion.Root provider');
    });
  });

  describe('Accordion: single and multiple', () => {
    it('keeps the open item open when not collapsible, and says so with aria-disabled', async () => {
      const onValueChange = vi.fn();
      render(Fixture, { props: { collapsible: false, value: 'shipping', onValueChange } });
      expect(trigger('Shipping').getAttribute('aria-disabled')).toBe('true');
      expect(trigger('Returns').hasAttribute('aria-disabled')).toBe(false);
      await fireEvent.click(trigger('Shipping'));
      expect(trigger('Shipping').getAttribute('aria-expanded')).toBe('true');
      expect(onValueChange).not.toHaveBeenCalled();
      await fireEvent.click(trigger('Returns'));
      expect(trigger('Shipping').hasAttribute('aria-disabled')).toBe(false);
      expect(trigger('Returns').getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('Accordion: keyboard', () => {
    it('keeps a nested accordion’s arrows inside it', async () => {
      render(Fixture, { props: { value: 'support', nested: true } });
      const email = trigger('Email');
      email.focus();
      await press('ArrowDown');
      expect(document.activeElement).toBe(trigger('Phone'));
      await press('ArrowDown');
      expect(document.activeElement).toBe(trigger('Email'));
      // The outer accordion still moves among its own triggers.
      trigger('Support').focus();
      await press('ArrowDown');
      expect(document.activeElement).toBe(trigger('Shipping'));
    });
  });

  describe('Accordion: content', () => {
    it('exposes its measured size as CSS variables for height animations', async () => {
      render(Fixture);
      await fireEvent.click(trigger('Returns'));
      flushSync();
      const panel = region('Returns') as HTMLElement;
      expect(panel.style.getPropertyValue('--tx-accordion-content-height')).toMatch(/^\d+px$/);
      expect(panel.style.getPropertyValue('--tx-accordion-content-width')).toMatch(/^\d+px$/);
    });
  });

  describe('Accordion: exit animation (presence)', () => {
    it('keeps a closing panel mounted until its exit animation ends', async () => {
      const style = document.createElement('style');
      style.textContent =
        "[role='region'][data-state='closed'] { animation-name: tx-close; animation-duration: 300ms; }";
      document.head.append(style);
      try {
        render(Fixture);
        await fireEvent.click(trigger('Returns'));
        const panel = region('Returns') as HTMLElement;
        await fireEvent.click(trigger('Returns'));
        flushSync();
        // Closing, but still in the DOM, visible to the animation and not hidden.
        expect(panel.isConnected).toBe(true);
        expect(panel.dataset.state).toBe('closed');
        expect(panel.hidden).toBe(false);
        // A re-render while exiting (another item opens) must not cut the exit short.
        await fireEvent.click(trigger('Shipping'));
        flushSync();
        expect(panel.isConnected).toBe(true);
        panel.dispatchEvent(new Event('animationend'));
        flushSync();
        expect(panel.isConnected).toBe(false);
      } finally {
        style.remove();
      }
    });
  });

  describe('Accordion: composition', () => {
    it('lets a consumer click handler cancel the toggle', async () => {
      const onTriggerClick = vi.fn((event: MouseEvent) => event.preventDefault());
      render(Fixture, { props: { onTriggerClick } });
      await fireEvent.click(trigger('Shipping'));
      expect(onTriggerClick).toHaveBeenCalledOnce();
      expect(trigger('Shipping').getAttribute('aria-expanded')).toBe('false');
    });
  });
});

describe('collapsible', () => {
  afterEach(cleanup);

  describe('@texuli/primitives/collapsible', () => {
    it('starts open when defaultOpen is true and preserves the control relation after exit', async () => {
      const { container } = render(CollapsibleHarness, { props: { initialOpen: true } });
      const trigger = screen.getByRole('button', { name: 'Shipping details' });
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(
        screen.getByText('Orders ship within two fictional days.').closest('[hidden]')
      ).toBeNull();

      await fireEvent.click(trigger);
      const content = container.querySelector<HTMLElement>('#shipping-content');
      expect(content).not.toBeNull();
      expect(content?.getAttribute('data-state')).toBe('closed');
      expect(content?.getAttribute('aria-hidden')).toBe('true');
      expect(content?.hasAttribute('inert')).toBe(true);
      expect(document.getElementById(trigger.getAttribute('aria-controls') ?? '')).toBe(content);
    });
  });
});

describe('tabs', () => {
  afterEach(cleanup);

  describe('Tabs', () => {
    it('keeps inactive panels hidden but mounted by default', () => {
      const view = render(TabsHarness, { props: { value: 'profile' } });
      const security = view.container.querySelector(
        '[data-tx-tabs-content][data-value="security"]'
      );
      expect(security).toBeTruthy();
      expect(security?.hasAttribute('hidden')).toBe(true);
    });
  });
});

describe('toggle', () => {
  afterEach(() => {
    cleanup();
  });

  describe('ToggleGroup', () => {
    it('single mode selects one item and allows clearing', async () => {
      const onValueChange = vi.fn();
      render(ToggleGroupFixture, {
        props: { type: 'single', onValueChange, label: 'Align' },
      });
      const left = screen.getByRole('button', { name: 'Left' });
      const center = screen.getByRole('button', { name: 'Center' });

      await fireEvent.click(left);
      expect(onValueChange).toHaveBeenLastCalledWith('left');
      expect(left.getAttribute('aria-pressed')).toBe('true');

      await fireEvent.click(center);
      expect(onValueChange).toHaveBeenLastCalledWith('center');
      expect(center.getAttribute('aria-pressed')).toBe('true');
      expect(left.getAttribute('aria-pressed')).toBe('false');

      await fireEvent.click(center);
      expect(onValueChange).toHaveBeenLastCalledWith('');
    });
  });
});

describe('toolbar', () => {
  afterEach(cleanup);

  const setup = async (props: Record<string, unknown> = {}) => {
    const view = render(ToolbarFixture, { props });
    await tick();
    const toolbar = view.getByRole('toolbar', { name: 'Formatting' });
    const item = (name: string) =>
      [...toolbar.querySelectorAll<HTMLElement>('[data-toolbar-item]')].find(
        (node) => node.textContent?.trim() === name
      ) as HTMLElement;
    return { view, toolbar, item };
  };

  describe('Toolbar (APG toolbar)', () => {
    it('passes links through the URL policy', async () => {
      const { toolbar } = await setup();
      const help = within(toolbar).getByRole('link', { name: 'Help' });
      expect(help.getAttribute('href')).toBe('https://example.com/help');
      const unsafe = within(toolbar).getByText('Unsafe');
      expect(unsafe.hasAttribute('href')).toBe(false);
      expect(unsafe.getAttribute('aria-disabled')).toBe('true');
    });
  });
});

describe('tree', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  describe('Tree.Root', () => {
    it('loads lazy children on pointer expansion and retries only after collapsing', async () => {
      render(TreeFixture);
      const archive = screen.getByRole('treeitem', { name: 'Archive' });
      await fireEvent.click(within(archive).getByText('▸'));

      expect(await screen.findByRole('treeitem', { name: 'Archived file' })).toBeTruthy();
      expect(screen.getByText('archive', { selector: '[data-expanded]' })).toBeTruthy();
    });

    it('keeps virtualized DOM bounded and scrolls the active row into the rendered window', async () => {
      render(TreeFixture);
      const tree = screen.getByRole('tree', { name: 'Project files' });
      expect(screen.getAllByRole('treeitem').length).toBeLessThan(10);

      tree.focus();
      await fireEvent.keyDown(tree, { key: 'End' });
      await waitFor(() => expect(screen.getByRole('treeitem', { name: 'File 30' })).toBeTruthy());
      const activeId = tree.getAttribute('aria-activedescendant');
      expect(activeId).toBe(screen.getByRole('treeitem', { name: 'File 30' }).id);
      expect(screen.getAllByRole('treeitem').length).toBeLessThan(10);
    });
  });
});

describe('listbox', () => {
  afterEach(cleanup);

  describe('@texuli/primitives/listbox', () => {
    it('uses the full collection order for a virtualized visible window', async () => {
      render(ListboxHarness, { props: { virtualized: true } });
      const listbox = screen.getByRole('listbox', { name: 'Colors' });

      await fireEvent.keyDown(listbox, { key: 'ArrowDown' });
      await fireEvent.keyDown(listbox, { key: 'ArrowDown' });
      await fireEvent.keyDown(listbox, { key: 'ArrowDown' });
      expect(screen.getByLabelText('Active option').textContent).toBe('jade');
      expect(screen.getByLabelText('Active index').textContent).toBe('3');
      const jade = screen.getByRole('option', { name: 'Jade' });
      expect(listbox.getAttribute('aria-activedescendant')).toBe(jade.id);
    });

    it('supports typeahead and disabled roots', async () => {
      const { unmount } = render(ListboxHarness);
      const listbox = screen.getByRole('listbox', { name: 'Colors' });
      await fireEvent.keyDown(listbox, { key: 'j' });
      expect(listbox.getAttribute('aria-activedescendant')).toContain('jade');
      unmount();

      render(ListboxHarness, { props: { disabled: true } });
      expect(screen.getByRole('listbox', { name: 'Colors' }).getAttribute('aria-disabled')).toBe(
        'true'
      );
    });
  });
});

describe('command', () => {
  afterEach(cleanup);

  function renderCommand(
    props: {
      debounceMs?: number;
      onSearch?: (query: string) => void | Promise<void>;
      onSelect?: (value: string) => void;
    } = {}
  ) {
    return render(CommandHarness, { props });
  }

  describe('@texuli/primitives/command', () => {
    it('filters by scored label and keywords while removing unmatched groups', async () => {
      renderCommand();
      const input = screen.getByRole('combobox');
      await fireEvent.input(input, { target: { value: 'settings' } });
      expect(input.getAttribute('aria-activedescendant')).toBe(
        screen.getByRole('option', { name: 'Settings' }).id
      );
      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(
        screen.getByRole('option', { name: 'Open settings' }).getAttribute('aria-selected')
      ).toBe('true');
      await fireEvent.input(input, { target: { value: 'mail' } });
      expect(screen.getByRole('option', { name: 'Open inbox' })).toBeTruthy();
      expect(screen.queryByRole('group', { name: 'Actions' })).toBeNull();
      await fireEvent.input(input, { target: { value: 'missing' } });
      expect(screen.queryByRole('option')).toBeNull();
      expect(screen.getByText('No results')).toBeTruthy();
    });

    it('leaves IME composition keys to the text input', async () => {
      const onSelect = vi.fn();
      renderCommand({ onSelect });
      const input = screen.getByRole('combobox');
      await fireEvent.keyDown(input, { key: 'ArrowDown', isComposing: true });
      expect(screen.getByRole('option', { name: 'Open inbox' }).getAttribute('aria-selected')).toBe(
        'true'
      );
      await fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('debounces async searches and ignores stale completions', async () => {
      let resolveOld: (() => void) | undefined;
      const onSearch = vi.fn((query: string) =>
        query === 'old'
          ? new Promise<void>((resolve) => {
              resolveOld = resolve;
            })
          : Promise.resolve()
      );
      renderCommand({ onSearch, debounceMs: 0 });
      const input = screen.getByRole('combobox');
      await fireEvent.input(input, { target: { value: 'old' } });
      await waitFor(() => expect(onSearch).toHaveBeenCalledWith('old'));
      await fireEvent.input(input, { target: { value: 'new' } });
      await waitFor(() => expect(onSearch).toHaveBeenCalledWith('new'));
      expect(screen.queryByText('Searching…')).toBeNull();
      resolveOld?.();
      await Promise.resolve();
      expect(screen.queryByText('Searching…')).toBeNull();
    });

    it('passes typed native input attributes through, keeping the ones it owns', () => {
      renderCommand();
      const input = screen.getByRole('combobox') as HTMLInputElement;
      expect(input.maxLength).toBe(40);
      expect(input.getAttribute('spellcheck')).toBe('false');
      expect(input.getAttribute('inputmode')).toBe('search');
      expect(input.getAttribute('autocomplete')).toBe('off');
      expect(input.getAttribute('aria-autocomplete')).toBe('list');
    });
  });
});

describe('pagination', () => {
  afterEach(cleanup);

  describe('Pagination.Root and parts', () => {
    it('accepts localized navigation and page labels', () => {
      const view = render(Pagination.Root, {
        props: {
          page: 2,
          pageCount: 3,
          label: 'Pages',
          previousLabel: 'Back',
          nextLabel: 'Forward',
          getPageLabel: (page: number) => `Page number ${page}`,
        },
      });

      expect(view.getByRole('navigation', { name: 'Pages' })).toBeTruthy();
      expect(view.getByRole('button', { name: 'Back' })).toBeTruthy();
      expect(view.getByRole('button', { name: 'Forward' })).toBeTruthy();
      expect(view.getByRole('button', { name: 'Page number 2' }).getAttribute('aria-current')).toBe(
        'page'
      );
    });
  });
});

describe('splitter', () => {
  afterEach(cleanup);

  describe('Splitter components', () => {
    const handleOf = (view: { container: HTMLElement }) =>
      within(view.container).getByRole('separator', { name: 'Resize navigation' });

    it('collapses with Enter (the pane goes inert), restores with Enter, and reports both', async () => {
      const onCollapse = vi.fn();
      const onExpand = vi.fn();
      const view = render(SplitterFixture, { props: { onCollapse, onExpand } });
      await tick();
      const handle = handleOf(view);
      await fireEvent.keyDown(handle, { key: 'ArrowRight' });
      await fireEvent.keyDown(handle, { key: 'Enter' });
      await tick();
      const pane = view.container.querySelector('#nav') as HTMLElement;
      expect(handle.getAttribute('aria-valuenow')).toBe('0');
      expect(pane.dataset.state).toBe('collapsed');
      expect(pane.hasAttribute('inert')).toBe(true);
      expect(onCollapse).toHaveBeenCalledOnce();
      await fireEvent.keyDown(handle, { key: 'Enter' });
      await tick();
      expect(handle.getAttribute('aria-valuenow')).toBe('40');
      expect(pane.dataset.state).toBe('expanded');
      expect(pane.hasAttribute('inert')).toBe(false);
      expect(onExpand).toHaveBeenCalledOnce();
    });

    it('drags with a pointer, measured against the group, and saves the layout when it ends', async () => {
      const data = new Map<string, string>();
      const storage: SplitterStorage = {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
      };
      const view = render(SplitterFixture, { props: { storage, autoSaveId: 'mail' } });
      await tick();
      const group = view.getByTestId('group');
      group.getBoundingClientRect = () =>
        ({
          x: 0,
          y: 0,
          width: 1000,
          height: 400,
          top: 0,
          left: 0,
          right: 1000,
          bottom: 400,
          toJSON: () => ({}),
        }) as DOMRect;
      const handle = handleOf(view);
      await fireEvent.pointerDown(handle, {
        pointerId: 1,
        clientX: 300,
        button: 0,
        pointerType: 'touch',
      });
      expect(handle.dataset.state).toBe('active');
      await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 450 });
      expect(handle.getAttribute('aria-valuenow')).toBe('45');
      expect(data.has('texuli-splitter:mail')).toBe(false);
      // A move from another pointer is ignored.
      await fireEvent.pointerMove(handle, { pointerId: 2, clientX: 900 });
      expect(handle.getAttribute('aria-valuenow')).toBe('45');
      await fireEvent.pointerUp(handle, { pointerId: 1, clientX: 450 });
      expect(handle.dataset.state).toBe('inactive');
      expect(data.get('texuli-splitter:mail')).toBe('[45,55]');
    });

    it('restores a saved layout on mount', async () => {
      const storage: SplitterStorage = { getItem: () => '[50,50]', setItem: () => {} };
      const view = render(SplitterFixture, { props: { storage, autoSaveId: 'mail' } });
      await tick();
      expect(handleOf(view).getAttribute('aria-valuenow')).toBe('50');
    });
  });
});

describe('scroll-area', () => {
  afterEach(() => {
    cleanup();
  });

  describe('ScrollArea', () => {
    it('type=hover starts hidden until pointer enters the root', async () => {
      render(ScrollAreaFixture, { props: { type: 'hover', itemCount: 30, height: 80 } });
      const root = screen.getByTestId('scroll-root');
      const viewport = screen.getByTestId('scroll-viewport');
      Object.defineProperty(viewport, 'clientHeight', { value: 80, configurable: true });
      Object.defineProperty(viewport, 'scrollHeight', { value: 500, configurable: true });
      Object.defineProperty(viewport, 'clientWidth', { value: 200, configurable: true });
      Object.defineProperty(viewport, 'scrollWidth', { value: 200, configurable: true });
      fireEvent.scroll(viewport);
      // hover type: not visible until hover
      expect(root.getAttribute('data-state')).toBe('hidden');
      await fireEvent.pointerEnter(root);
      expect(root.getAttribute('data-state')).toBe('visible');
    });

    it('sizes and moves the thumb from the live scroll metrics', async () => {
      render(ScrollAreaFixture, { props: { type: 'always', itemCount: 30, height: 100 } });
      const viewport = screen.getByTestId('scroll-viewport');
      Object.defineProperty(viewport, 'clientHeight', { value: 100, configurable: true });
      Object.defineProperty(viewport, 'scrollHeight', { value: 400, configurable: true });
      Object.defineProperty(viewport, 'clientWidth', { value: 200, configurable: true });
      Object.defineProperty(viewport, 'scrollWidth', { value: 200, configurable: true });
      fireEvent.scroll(viewport);
      // The thumb mounts once the scrollbar shows; it must keep following the metrics.
      const thumb = await screen.findByTestId('scroll-y-thumb');
      await waitFor(() => {
        expect(thumb.style.getPropertyValue('--tx-sa-thumb-size-y').trim()).toBe('25%');
        expect(thumb.style.getPropertyValue('--tx-sa-thumb-offset-y').trim()).toBe('0%');
      });
      (viewport as HTMLElement).scrollTop = 300;
      fireEvent.scroll(viewport);
      await waitFor(() => {
        expect(thumb.style.getPropertyValue('--tx-sa-thumb-offset-y').trim()).toBe('75%');
      });
    });

    it('hides the corner when only one axis overflows', async () => {
      render(ScrollAreaFixture, { props: { type: 'always', itemCount: 20, height: 80 } });
      const viewport = screen.getByTestId('scroll-viewport');
      Object.defineProperty(viewport, 'clientHeight', { value: 80, configurable: true });
      Object.defineProperty(viewport, 'scrollHeight', { value: 400, configurable: true });
      Object.defineProperty(viewport, 'clientWidth', { value: 200, configurable: true });
      Object.defineProperty(viewport, 'scrollWidth', { value: 200, configurable: true });
      fireEvent.scroll(viewport);
      await waitFor(() => {
        expect(screen.queryByTestId('scroll-corner')).toBeNull();
      });
    });
  });
});

describe('separator', () => {
  afterEach(cleanup);

  describe('Separator.Root', () => {
    it('passes other attributes through but keeps its role and orientation authoritative', () => {
      const view = render(Separator.Root, {
        props: {
          class: 'rule',
          id: 'section-break',
          'data-testid': 'rule',
          // A consumer cannot override the semantics through attributes.
          'aria-orientation': 'vertical',
        } as never,
      });
      const node = view.getByTestId('rule');
      expect(node.className).toBe('rule');
      expect(node.id).toBe('section-break');
      expect(node.getAttribute('role')).toBe('separator');
      expect(node.hasAttribute('aria-orientation')).toBe(false);
    });

    it('renders a child snippet with its props spread on the consumer element', () => {
      const view = render(ChildFixture);
      const custom = view.getByTestId('custom');
      expect(custom.tagName).toBe('HR');
      expect(custom.getAttribute('role')).toBe('separator');
      expect(custom.getAttribute('aria-orientation')).toBe('vertical');
      expect(custom.className).toBe('rule');
      expect(view.container.querySelectorAll('[data-separator-root]')).toHaveLength(1);
    });
  });
});

describe('progress', () => {
  afterEach(cleanup);

  describe('Progress.Root', () => {
    it('clamps value into [min, max] and marks complete at max', () => {
      const high = render(ProgressRoot, {
        props: { value: 150, max: 100, 'aria-label': 'Done' },
      });
      expect(high.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
      expect(high.getByRole('progressbar').getAttribute('data-state')).toBe('complete');
      high.unmount();

      const low = render(ProgressRoot, {
        props: { value: -10, min: 0, max: 50, 'aria-label': 'Low' },
      });
      expect(low.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    });

    it('omits aria-valuenow when indeterminate (value null)', () => {
      const view = render(ProgressRoot, {
        props: { value: null, max: 100, 'aria-label': 'Working' },
      });
      const bar = view.getByRole('progressbar', { name: 'Working' });
      expect(bar.hasAttribute('aria-valuenow')).toBe(false);
      expect(bar.getAttribute('data-state')).toBe('indeterminate');
      expect(bar.getAttribute('data-value')).toBeNull();
    });
  });
});

describe('avatar', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  /** 1×1 PNG (valid developer data URI). */
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  describe('Avatar', () => {
    it('keeps the fallback through delayMs after load', async () => {
      vi.useFakeTimers();
      const view = render(AvatarHarness, {
        props: {
          src: PNG,
          srcTrust: 'developer',
          delayMs: 50,
          alt: 'Delayed',
        },
      });
      const img = view.container.querySelector('[data-tx-avatar-image]') as HTMLImageElement;
      await fireEvent.load(img);
      expect(
        view.container.querySelector('[data-tx-avatar-root]')?.getAttribute('data-state')
      ).toBe('loading');
      expect(view.container.querySelector('[data-tx-avatar-fallback]')).toBeTruthy();
      await vi.advanceTimersByTimeAsync(50);
      expect(
        view.container.querySelector('[data-tx-avatar-root]')?.getAttribute('data-state')
      ).toBe('loaded');
      expect(view.container.querySelector('[data-tx-avatar-fallback]')).toBeNull();
    });

    it('shows fallback on error and for unsafe sources', async () => {
      const onLoadingStatusChange = vi.fn();
      const bad = render(AvatarHarness, {
        props: {
          src: 'javascript:alert(1)',
          alt: 'Bad',
          onLoadingStatusChange,
        },
      });
      await waitFor(() => {
        expect(
          bad.container.querySelector('[data-tx-avatar-root]')?.getAttribute('data-state')
        ).toBe('error');
      });
      expect(bad.container.querySelector('[data-tx-avatar-image]')).toBeNull();
      expect(bad.container.querySelector('[data-tx-avatar-fallback]')?.textContent).toContain('AE');
      expect(onLoadingStatusChange).toHaveBeenCalledWith('error');
      bad.unmount();

      const fail = render(AvatarHarness, {
        props: {
          src: PNG,
          srcTrust: 'developer',
          alt: 'Fail',
        },
      });
      const img = fail.container.querySelector('[data-tx-avatar-image]') as HTMLImageElement;
      await fireEvent.error(img);
      await waitFor(() => {
        expect(
          fail.container.querySelector('[data-tx-avatar-root]')?.getAttribute('data-state')
        ).toBe('error');
      });
      expect(fail.container.querySelector('[data-tx-avatar-fallback]')).toBeTruthy();
    });
  });
});

describe('handler-compose', () => {
  afterEach(() => cleanup());

  // G26 audit: a consumer handler on a part never replaces the part's own
  // handler, and a handler that used to be silently dropped now runs.
  it('runs the consumer handler and keeps the part behavior on every audited part', async () => {
    const cases: {
      kind: Parameters<typeof HandlerComposeHarness>[1]['kind'];
      act: () => Promise<unknown>;
      log: string[];
      state?: string;
      check?: () => string;
      expected?: RegExp;
    }[] = [
      {
        kind: 'radio-item',
        act: () => fireEvent.click(screen.getByRole('radio', { name: 'B' })),
        log: ['click'],
        state: 'b',
      },
      {
        kind: 'toggle',
        act: () => fireEvent.click(screen.getByRole('button', { name: 'Bold' })),
        log: ['click'],
        state: 'true',
      },
      {
        kind: 'toggle-group-item',
        act: () => fireEvent.click(screen.getByRole('button', { name: 'Left' })),
        log: ['click'],
        state: 'left',
      },
      {
        kind: 'tabs-trigger',
        act: () => fireEvent.click(screen.getByRole('tab', { name: 'B' })),
        log: ['click'],
        state: 'b',
      },
      {
        kind: 'listbox',
        act: async () => {
          const box = screen.getByRole('listbox', { name: 'Colors' });
          box.focus();
          await fireEvent.keyDown(box, { key: 'ArrowDown' });
          await fireEvent.keyDown(box, { key: 'Enter' });
        },
        log: ['keydown', 'keydown'],
        state: 'amber',
      },
      {
        kind: 'pin-input',
        act: async () => {
          const input = screen.getByRole('textbox', { name: 'Code' });
          await fireEvent.focus(input);
          await fireEvent.input(input, { target: { value: '12' } });
        },
        log: ['focus', 'input'],
        state: '12',
      },
      {
        kind: 'tags-input-tag',
        act: () => fireEvent.focus(screen.getByText('design').closest('li') as HTMLElement),
        log: ['focus'],
      },
      {
        kind: 'calendar-grid',
        act: async () => {
          const grid = screen.getByRole('grid');
          const cell = grid.querySelector<HTMLElement>('button[tabindex="0"]') ?? grid;
          await fireEvent.keyDown(cell, { key: 'ArrowRight' });
        },
        log: ['keydown'],
        // The grid's own keydown still moved the focused date.
        check: () =>
          screen
            .getByRole('grid')
            .querySelector('button[tabindex="0"]')
            ?.getAttribute('aria-label') ?? '',
        expected: /February 16, 2024/,
      },
    ];
    for (const { kind, act, log, state, check, expected } of cases) {
      const seen: string[] = [];
      const view = render(HandlerComposeHarness, { props: { kind, log: seen } });
      await act();
      await tick();
      expect(seen, kind).toEqual(log);
      if (state !== undefined) expect(view.getByTestId('state').textContent, kind).toBe(state);
      if (check && expected) expect(check(), kind).toMatch(expected);
      view.unmount();
    }
  });

  it('lets a consumer cancel the part behavior with preventDefault', async () => {
    const seen: string[] = [];
    const view = render(HandlerComposeHarness, {
      props: { kind: 'radio-item', log: seen, prevent: true },
    });
    await fireEvent.click(view.getByRole('radio', { name: 'B' }));
    expect(seen).toEqual(['click']);
    expect(view.getByTestId('state').textContent).toBe('a');
  });

  it('gives CollapsibleRoot a bindable ref and spreads its rest attributes', async () => {
    const box: { current: HTMLElement | null } = { current: null };
    const view = render(HandlerComposeHarness, {
      props: {
        kind: 'collapsible',
        get ref() {
          return box.current;
        },
        set ref(value: HTMLElement | null) {
          box.current = value;
        },
      },
    });
    await vi.waitFor(() => expect(box.current).toBeInstanceOf(HTMLElement));
    expect(box.current?.getAttribute('data-probe')).toBe('probe');
    expect(box.current?.getAttribute('aria-describedby')).toBe('note');
    view.unmount();
  });
});
