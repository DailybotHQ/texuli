<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type TabsActivationMode, type TabsOrientation, tabsContext } from './context.ts';

type Props = HTMLAttributes<HTMLDivElement> & {
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: TabsOrientation;
  /** `automatic` selects on focus; `manual` only on activate. Default automatic. */
  activationMode?: TabsActivationMode;
  loop?: boolean;
  disabled?: boolean;
  class?: string;
  children?: import('svelte').Snippet;
};

let {
  value = $bindable(''),
  onValueChange,
  orientation = 'horizontal',
  activationMode = 'automatic',
  loop = false,
  disabled = false,
  class: className,
  children,
  ...rest
}: Props = $props();

const uid = $props.id();
const baseId = `tx-tabs-${uid}`;
/** Consumer ids claimed by triggers and panels (`trigger:<value>`), winning over the generated ones. */
let claimedIds = $state<Record<string, string | undefined>>({});

type TriggerReg = { value: string; element: HTMLElement; disabled: boolean };
const triggers: TriggerReg[] = [];

function registerTrigger(entry: TriggerReg): () => void {
  triggers.push(entry);
  return () => {
    const index = triggers.indexOf(entry);
    if (index >= 0) triggers.splice(index, 1);
  };
}

function select(next: string): void {
  if (disabled) return;
  const target = triggers.find((t) => t.value === next);
  if (!target || target.disabled) return;
  if (value === next) return;
  value = next;
  onValueChange?.(next);
}

function triggerId(tabValue: string): string {
  return claimedIds[`trigger:${tabValue}`] || `${baseId}-tab-${tabValue}`;
}

function contentId(tabValue: string): string {
  return claimedIds[`content:${tabValue}`] || `${baseId}-panel-${tabValue}`;
}

tabsContext.set({
  value: () => value,
  select,
  orientation: () => orientation,
  activationMode: () => activationMode,
  disabled: () => disabled,
  loop: () => loop,
  baseId: () => baseId,
  triggerId,
  contentId,
  claimId(part, tabValue, id) {
    claimedIds[`${part}:${tabValue}`] = id || undefined;
  },
  registerTrigger,
});
</script>

<div
  class={className}
  data-orientation={orientation}
  data-disabled={disabled ? '' : undefined}
  data-activation={activationMode}
  {...rest}
>
  {@render children?.()}
</div>
