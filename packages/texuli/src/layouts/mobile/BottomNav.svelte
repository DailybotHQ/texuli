<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import NavIcon from '../host/NavIcon.svelte';
import { type BottomNavItem, bottomNavCurrent } from './model.ts';
import './mobile.css';

/**
 * A standalone mobile tab bar: a named `nav` landmark with one link per
 * destination (icon, label, optional badge). The current link carries
 * `aria-current` and a bar, so it never relies on color alone. Sticky at the
 * bottom of its scroll container by default; `fixed` pins it to the viewport.
 */
type OwnProps = {
  items: readonly BottomNavItem[];
  /** Accessible name of the landmark. Default "Primary". */
  label?: string;
  /** Pin to the viewport bottom instead of sticking in the flow. Default `false`. */
  fixed?: boolean;
  /** URL trust for item hrefs. Default `developer` (app-authored). */
  hrefTrust?: HrefTrust;
  /** Called on activation (client routers); call `event.preventDefault()` to stop the link. */
  onSelect?: (item: BottomNavItem, event: MouseEvent) => void;
  class?: ClassValue;
  /** The `nav` element (bindable). */
  ref?: HTMLElement | null;
};
type Props = OwnProps & Omit<HTMLAttributes<HTMLElement>, keyof OwnProps>;

let {
  items,
  label: labelProp,
  fixed = false,
  hrefTrust = 'developer',
  onSelect,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const label = $derived(labelProp ?? msg('texuli.bottom-nav.label', 'Primary'));
</script>

<nav
  {...rest}
  bind:this={ref}
  class={cx('tx-mobile-tabs', fixed && 'tx-mobile-tabs--fixed', className)}
  aria-label={label}
  data-tx-bottom-nav=""
>
  <ul class="tx-mobile-tabs__list">
    {#each items as item (item.id ?? item.href)}
      <li class="tx-mobile-tabs__item">
        <a
          class="tx-mobile-tabs__tab"
          href={safeHref(item.href, hrefTrust)}
          aria-current={bottomNavCurrent(item)}
          data-tx-bottom-nav-item={item.id ?? item.href}
          onclick={onSelect ? (event) => onSelect(item, event) : undefined}
        >
          <NavIcon icon={item.icon} class="tx-mobile-tabs__icon" />
          <span class="tx-mobile-tabs__label">{item.label}</span>
          {#if item.badge !== undefined && item.badge !== ''}
            <span class="tx-mobile-tabs__badge">{item.badge}</span>
          {/if}
        </a>
      </li>
    {/each}
  </ul>
</nav>
