<script lang="ts">
import type { Snippet } from 'svelte';
import { tick } from 'svelte';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import type { SettingsNavItem } from './types.ts';
import './auth-settings.css';

/**
 * Settings shell: section list + detail. On phones the list and detail are
 * alternate screens; from `md` both show. Each section remounts via `{#key}`.
 */
type Props = {
  title?: string;
  description?: string;
  sections: readonly SettingsNavItem[];
  /** Open section id (`bind:active`). */
  active?: string;
  onSelect?: (id: string) => void;
  /**
   * Phones start on the section list unless a section was requested.
   * Read once at mount.
   */
  startWithList?: boolean;
  /** Renders the open section body; receives the section id. */
  children: Snippet<[string]>;
  /** LayoutHost: optional stable screen target instead of `children`. */
  mountScreen?: (target: HTMLElement) => void;
  /** Accessible name of the section list. */
  navLabel?: string;
  /** Back control label on phones. */
  backLabel?: string;
  class?: ClassValue;
};

let {
  title: titleProp,
  description,
  sections,
  active = $bindable(sections[0]?.id ?? ''),
  onSelect,
  startWithList = true,
  children,
  mountScreen,
  navLabel,
  backLabel,
  class: className,
}: Props = $props();
const msg = useMessages();
const title = $derived(titleProp ?? msg('texuli.settings-layout.title', 'Settings'));

const uid = $props.id();
// svelte-ignore state_referenced_locally
let listOpen = $state(startWithList);
let detailHeading = $state<HTMLHeadingElement | undefined>();
let nav = $state<HTMLElement | undefined>();
let screenTarget = $state<HTMLDivElement | undefined>();

const current = $derived(sections.find((section) => section.id === active) ?? sections[0]);
const mode = $derived(listOpen ? 'list' : 'detail');
const resolvedNavLabel = $derived(navLabel ?? `${title} sections`);
const resolvedBack = $derived(backLabel ?? title);

$effect(() => {
  if (mountScreen && screenTarget) mountScreen(screenTarget);
});

async function choose(id: string): Promise<void> {
  active = id;
  onSelect?.(id);
  listOpen = false;
  await tick();
  detailHeading?.focus();
}

async function backToList(): Promise<void> {
  listOpen = true;
  await tick();
  nav?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
}
</script>

<div
  class={cx('tx-settings-layout', className)}
  data-tx-layout="settings"
  data-tx-settings-layout
  data-mode={mode}
>
  <header class="tx-settings-layout__header">
    <h1 class="tx-settings-layout__title">{title}</h1>
    {#if description}
      <p class="tx-settings-layout__description">{description}</p>
    {/if}
  </header>

  <div class="tx-settings-layout__grid">
    <nav bind:this={nav} class="tx-settings-layout__nav" aria-label={resolvedNavLabel}>
      <ul class="tx-settings-layout__nav-list">
        {#each sections as section (section.id)}
          {@const selected = section.id === current?.id}
          <li>
            <button
              type="button"
              class="tx-settings-layout__nav-item"
              aria-current={selected ? 'page' : undefined}
              onclick={() => void choose(section.id)}
            >
              <span class="tx-settings-layout__nav-copy">
                <span class="tx-settings-layout__nav-label">{section.label}</span>
                {#if section.description}
                  <span class="tx-settings-layout__nav-desc">{section.description}</span>
                {/if}
              </span>
              <span class="tx-settings-layout__chevron" aria-hidden="true">›</span>
            </button>
          </li>
        {/each}
      </ul>
    </nav>

    <section
      class="tx-settings-layout__detail"
      aria-labelledby={`tx-settings-${uid}-heading`}
    >
      <button type="button" class="tx-settings-layout__back" onclick={() => void backToList()}>
        <span aria-hidden="true">‹</span>
        {resolvedBack}
      </button>
      <h2
        bind:this={detailHeading}
        id={`tx-settings-${uid}-heading`}
        tabindex="-1"
        class="tx-settings-layout__detail-title"
      >
        {current?.label ?? ''}
      </h2>
      {#if mountScreen}
        <div bind:this={screenTarget} data-tx-layout-screen-target></div>
      {:else if current}
        {#key current.id}
          {@render children(current.id)}
        {/key}
      {/if}
    </section>
  </div>
</div>
