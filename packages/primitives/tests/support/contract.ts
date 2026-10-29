/**
 * The component API contract, checked at the public boundary of every
 * exported Svelte component (docs/STANDARDS.md, "Component API contract").
 *
 * Each part is mounted inside a family harness, with probe props from
 * `probe(key)`: a `data-contract` marker, an `aria-keyshortcuts` value and an
 * `id`. For the part under test the probe also adds `onclick`, `onkeydown`,
 * `onpointerdown` and `onfocus` handlers that record their calls (and, in
 * `prevent` mode, call `event.preventDefault()`). The checks:
 *
 * 1. rest attributes (`data-*`, `aria-*`, `id`) land on the part's root
 *    element (for a split form control: on the focusable control inside it);
 * 2. `bind:ref` points at that element (`ref` contains it for split controls);
 * 3. a caller `onclick`, `onkeydown` (Enter), `onpointerdown` (mouse) and
 *    `onfocus` runs, and the part's own behavior still runs: the page after
 *    the event is the same with or without the caller handler;
 * 4. a caller that calls `preventDefault()` on `click` or `keydown` skips the
 *    part's own behavior (the page is the same as with no event at all),
 *    unless the part documents that behavior as bookkeeping that always runs;
 *    `focus` cannot be prevented, so its behavior always runs. `pointerdown`
 *    is checked by rule 3 only: in a harness, other open layers close on a
 *    document-level outside press, which is not the part's own behavior.
 *
 * "The page" is a snapshot of `document.body` plus the focused element.
 * Svelte's id counter is reset before every mount so generated ids match.
 */
import { render } from '@testing-library/svelte';
import { type Component, flushSync, tick } from 'svelte';

export type ContractEvent = 'click' | 'keydown' | 'pointerdown' | 'focus';
export type ProbeMode = 'off' | 'observe' | 'prevent';

export interface ContractCall {
  key: string;
  event: ContractEvent;
  currentTarget: EventTarget | null;
}

export interface ContractRun {
  /** The part whose handlers the probe adds; others get attributes only. */
  target: string;
  mode: ProbeMode;
  calls: ContractCall[];
}

export type Probe = (key: string) => Record<string, unknown>;

export interface HarnessProps {
  /** Probe props for one part; spread them on the part. */
  p: Probe;
  /** Bound refs by part key (`bind:ref={refs[key]}`); parts bind every element type. */
  // biome-ignore lint/suspicious/noExplicitAny: one record binds HTML and SVG element refs
  refs: Record<string, any>;
  /** Harness-specific variant (which parts render). */
  variant?: string;
}

export interface ContractCase {
  /** Source path of the component under `src/`, without `.svelte` (`menu/Item`). */
  key: string;
  // biome-ignore lint/suspicious/noExplicitAny: harnesses take HarnessProps
  harness: Component<any>;
  variant?: string;
  /**
   * A form control that splits its attributes: `aria-*`, `data-*`, `id` and
   * handlers reach the focusable control inside the root; `ref` is the root.
   */
  split?: boolean;
  /** Why a consumer `id` cannot land on this part (ids derived from data). */
  idOwned?: string;
  /** Events whose own behavior always runs, even when the caller prevents the default. */
  chain?: Partial<Record<'click' | 'keydown', string>>;
  /** Why an event does not apply to this part (it never receives it). */
  skip?: Partial<Record<ContractEvent, string>>;
}

const SHORTCUT = 'Alt+Shift+K';

export function contractId(key: string): string {
  return `contract-${key.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}`;
}

export function createProbe(run: ContractRun): Probe {
  return (key: string) => {
    const props: Record<string, unknown> = {
      'data-contract': key,
      'aria-keyshortcuts': SHORTCUT,
      id: contractId(key),
    };
    if (key !== run.target || run.mode === 'off') return props;
    for (const event of ['click', 'keydown', 'pointerdown', 'focus'] as const) {
      props[`on${event}`] = (e: Event) => {
        run.calls.push({ key, event, currentTarget: e.currentTarget });
        if (run.mode === 'prevent') e.preventDefault();
      };
    }
    return props;
  };
}

function resetSvelteIds(): void {
  const svelte = (globalThis as { __svelte?: { uid?: number } }).__svelte;
  if (svelte) svelte.uid = 1;
}

async function settle(): Promise<void> {
  flushSync();
  await tick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
  await tick();
}

function describeFocus(): string {
  const active = document.activeElement;
  if (!active || active === document.body) return 'body';
  const all = Array.from(document.body.querySelectorAll('*'));
  return `${active.tagName}#${all.indexOf(active)}`;
}

function snapshot(): string {
  const body = document.body.cloneNode(true) as HTMLElement;
  // The shared live-region singleton outlives a mount; it is not the part's state.
  for (const node of body.querySelectorAll('[data-texuli-announcer]')) node.remove();
  return `${body.innerHTML}\n@focus=${describeFocus()}`;
}

function fire(element: Element, event: ContractEvent): void {
  if (event === 'click') {
    element.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, composed: true })
    );
  } else if (event === 'pointerdown') {
    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'mouse',
        button: 0,
        pointerId: 1,
      })
    );
  } else if (event === 'keydown') {
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
  } else {
    const html = element as HTMLElement;
    html.focus?.();
    if (document.activeElement !== element) {
      // Not focusable by itself: dispatch the events a focus would.
      element.dispatchEvent(new FocusEvent('focus', { bubbles: false }));
      element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    }
  }
}

interface Mounted {
  refs: Record<string, Element | null>;
  run: ContractRun;
  unmount(): void;
}

async function mount(
  c: ContractCase,
  mode: ProbeMode,
  makeRefs: () => Record<string, Element | null>
): Promise<Mounted> {
  document.body.innerHTML = '';
  resetSvelteIds();
  const run: ContractRun = { target: c.key, mode, calls: [] };
  const refs = makeRefs();
  const view = render(c.harness, {
    props: { p: createProbe(run), refs, ...(c.variant ? { variant: c.variant } : {}) },
  });
  await settle();
  return { refs, run, unmount: () => view.unmount() };
}

function findPart(key: string): Element[] {
  return Array.from(document.querySelectorAll(`[data-contract="${CSS.escape(key)}"]`));
}

/**
 * Check one part: the failed rules (empty when the part holds the contract)
 * and the events whose own behavior was observable.
 */
export async function checkContract(
  c: ContractCase,
  makeRefs: () => Record<string, Element | null>
): Promise<{ failures: string[]; observed: ContractEvent[] }> {
  const failures: string[] = [];
  /** Events whose own behavior changed the page (so the composition checks bite). */
  const observed: ContractEvent[] = [];
  const base = await mount(c, 'off', makeRefs);
  const parts = findPart(c.key);
  if (parts.length !== 1) {
    base.unmount();
    return {
      failures: [`expected one element with the rest attributes, found ${parts.length}`],
      observed,
    };
  }
  const element = parts[0] as Element;
  const ref = base.refs[c.key];
  if (element.getAttribute('aria-keyshortcuts') !== SHORTCUT) {
    failures.push('aria-* rest attribute missing on the element with data-*');
  }
  if (!(ref instanceof Element)) failures.push('bind:ref is not an Element');
  else if (c.split ? !ref.contains(element) : ref !== element) {
    failures.push(
      `bind:ref is <${ref.tagName.toLowerCase()}>, not the element with the rest attributes (<${element.tagName.toLowerCase()}>)`
    );
  }
  if (!c.idOwned && element.id !== contractId(c.key)) {
    failures.push(`id "${element.id}" is not the caller id`);
  }
  const none = snapshot();
  base.unmount();

  for (const event of ['click', 'keydown', 'pointerdown', 'focus'] as const) {
    if (c.skip?.[event]) continue;
    const plain = await mount(c, 'off', makeRefs);
    fire(findPart(c.key)[0] as Element, event);
    await settle();
    const withoutCaller = snapshot();
    plain.unmount();
    if (withoutCaller !== none) observed.push(event);

    const watched = await mount(c, 'observe', makeRefs);
    const target = findPart(c.key)[0] as Element;
    fire(target, event);
    await settle();
    const withCaller = snapshot();
    const calls = watched.run.calls.filter((call) => call.event === event);
    // A split control may keep handlers on its root (ref) instead of the control.
    const root = c.split ? watched.refs[c.key] : null;
    if (
      !calls.some((call) => call.currentTarget === target || (root && call.currentTarget === root))
    ) {
      failures.push(`caller on${event} did not run on the element`);
    }
    watched.unmount();
    if (withCaller !== withoutCaller) {
      failures.push(`caller on${event} changed the part's own behavior`);
    }

    if (event === 'pointerdown') continue;
    const prevented = await mount(c, 'prevent', makeRefs);
    fire(findPart(c.key)[0] as Element, event);
    await settle();
    const afterPrevent = snapshot();
    prevented.unmount();
    if (event === 'focus' || c.chain?.[event]) {
      if (afterPrevent !== withoutCaller) {
        failures.push(`on${event}: the part's own behavior must always run`);
      }
    } else if (withoutCaller !== none && afterPrevent !== none) {
      failures.push(`caller preventDefault() on ${event} did not skip the part's own behavior`);
    }
  }
  return { failures, observed };
}

/**
 * Every Svelte component reachable from a package's export entries, keyed by
 * its source path under `src/` (without `.svelte`). `entries` are the
 * modules behind the package.json `exports`; `sources` maps every component
 * in `src/` to its path. Namespaces and part objects are walked.
 */
export function exportedComponents(
  entries: readonly Record<string, unknown>[],
  sources: Map<unknown, string>
): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const seen = new Set<unknown>();
  function visit(value: unknown, name: string, depth: number): void {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return;
    const key = sources.get(value);
    if (key) {
      const names = found.get(key) ?? [];
      names.push(name);
      found.set(key, names);
      return;
    }
    if (typeof value !== 'object' || depth > 2 || seen.has(value)) return;
    seen.add(value);
    for (const [child, inner] of Object.entries(value)) {
      visit(inner, name ? `${name}.${child}` : child, depth + 1);
    }
  }
  for (const entry of entries) visit(entry, '', 0);
  return found;
}
