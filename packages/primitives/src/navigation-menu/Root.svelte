<script lang="ts">
import { bindDismissLayer } from '@texuli/core/dismiss';
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { SvelteMap } from 'svelte/reactivity';
import { chainHandlers, composeHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import { type NavigationMenuContextValue, navigationMenuContext } from './context.ts';
import { createNavigationMenuController, motionBetween } from './controller.ts';

type RootProps = Omit<HTMLAttributes<HTMLElement>, 'dir'> & {
  /** The open item's value, or `''` (`bind:value`). */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Milliseconds a pointer rests on a trigger before its item opens. */
  delayDuration?: number;
  /** Milliseconds after a close during which hovering opens at once. */
  skipDelayDuration?: number;
  orientation?: 'horizontal' | 'vertical';
  dir?: 'ltr' | 'rtl';
  children?: Snippet;
};

let {
  value = $bindable(''),
  onValueChange,
  delayDuration = 200,
  skipDelayDuration = 300,
  orientation = 'horizontal',
  dir,
  children,
  ref = $bindable(null),
  onkeydown,
  onfocusin,
  onpointerleave,
  ...rest
}: RootProps & RefProp = $props();

const uid = $props.id();
/** Consumer ids claimed by item parts, keyed by item value; they win over the generated ones. */
const claims = $state<{ trigger: Record<string, string>; content: Record<string, string> }>({
  trigger: {},
  content: {},
});
let current = $state('');
let previous = $state('');
let order: string[] = $state([]);

const controller = createNavigationMenuController({
  get delayDuration() {
    return delayDuration;
  },
  get skipDelayDuration() {
    return skipDelayDuration;
  },
  onChange(next) {
    previous = current;
    current = next;
    value = next;
    onValueChange?.(next);
  },
});

// A controlled `value` from outside opens or closes without notifying back.
$effect.pre(() => {
  const incoming = value ?? '';
  if (incoming === current) return;
  controller.sync(incoming);
  previous = current;
  current = incoming;
});

$effect(() => () => controller.destroy());

const safeId = (item: string) => item.replace(/[^A-Za-z0-9_-]/g, '-');

const context: NavigationMenuContextValue = $state({
  get value() {
    return current;
  },
  get orientation() {
    return orientation;
  },
  get motion() {
    return motionBetween(previous, current, order);
  },
  get order() {
    return order;
  },
  viewport: false,
  contents: new SvelteMap(),
  root: null,
  toggle: (item: string) => controller.toggle(item),
  close({ focusTrigger = false } = {}) {
    const open = current;
    controller.close();
    if (focusTrigger && open) {
      context.root?.ownerDocument.getElementById(context.triggerId(open))?.focus();
    }
  },
  pointerEnterTrigger: (item: string) => controller.pointerEnterTrigger(item),
  pointerLeave: () => controller.pointerLeave(),
  pointerEnterContent: () => controller.pointerEnterContent(),
  register(item: string) {
    // Called from an effect: read the list untracked so registering never re-runs it.
    order = [...untrack(() => order), item];
    return () => {
      order = untrack(() => order).filter((entry) => entry !== item);
    };
  },
  triggerId: (item: string) => claims.trigger[item] || `${uid}-trigger-${safeId(item)}`,
  contentId: (item: string) => claims.content[item] || `${uid}-content-${safeId(item)}`,
  claimId(part, item, id) {
    if (id) claims[part][item] = id;
    else delete claims[part][item];
  },
});
navigationMenuContext.set(context);
$effect(() => {
  ref = context.root;
});

// Pressing or focusing outside the navigation closes the open item.
function dismissOutside(node: HTMLElement) {
  const binding = bindDismissLayer({
    element: node,
    document: node.ownerDocument,
    onPointerOutside: () => controller.close(),
    onFocusOutside: () => controller.close(),
  });
  return () => binding.disconnect();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !current) return;
  event.preventDefault();
  context.close({ focusTrigger: true });
}

function onFocusIn(event: FocusEvent): void {
  if (!current) return;
  const target = event.target as Element | null;
  const doc = context.root?.ownerDocument;
  const trigger = doc?.getElementById(context.triggerId(current));
  const content = doc?.getElementById(context.contentId(current));
  // Focus moving to another item (or the list) closes the open one.
  if (target && !trigger?.contains(target) && !content?.contains(target)) controller.close();
}
</script>

<nav
  bind:this={context.root}
  data-orientation={orientation}
  data-state={current ? 'open' : 'closed'}
  {dir}
  {...rest}
  onkeydown={composeHandlers(onkeydown, onKeydown)}
  onfocusin={chainHandlers(onfocusin, onFocusIn)}
  onpointerleave={chainHandlers(onpointerleave, (event: PointerEvent) => {
    if (event.pointerType === 'mouse') controller.pointerLeave();
  })}
  {@attach current ? dismissOutside : undefined}
>
  {@render children?.()}
</nav>
