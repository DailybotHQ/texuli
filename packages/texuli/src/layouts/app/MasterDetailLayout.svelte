<script lang="ts">
import { useMessages } from '../../i18n/use-messages.ts';
/**
 * Master-detail layout: list of primary destinations + detail screen.
 * Wide: list and detail side by side. Narrow: list or detail with a Back link.
 */
import type { ClassValue } from '../../internal/cx.ts';
import { cx } from '../../internal/cx.ts';
import LayoutChrome from '../host/LayoutChrome.svelte';
import { onNavigate } from '../host/layout-kit.ts';
import NavIcon from '../host/NavIcon.svelte';
import { navBadge, navPath, type ResolvedNavItem, resolveNav } from '../host/nav-model.ts';
import type { LayoutProps } from '../host/registry.ts';
import { currentHashPath } from './model.ts';
import './app.css';

type Props = LayoutProps & {
  skipLabel?: string;
  listLabel?: string;
  detailLabel?: string;
  backLabel?: string;
  emptyLabel?: string;
  class?: ClassValue;
};

let {
  mountScreen,
  nav,
  path,
  options,
  skipLabel,
  listLabel: listLabelProp,
  detailLabel: detailLabelProp,
  backLabel: backLabelProp,
  emptyLabel: emptyLabelProp,
  class: className,
}: Props = $props();
const msg = useMessages();
const listLabel = $derived(listLabelProp ?? msg('texuli.master-detail-layout.list-label', 'List'));
const detailLabel = $derived(
  detailLabelProp ?? msg('texuli.master-detail-layout.detail-label', 'Detail')
);
const backLabel = $derived(backLabelProp ?? msg('texuli.master-detail-layout.back-label', 'Back'));
const emptyLabel = $derived(
  emptyLabelProp ??
    msg('texuli.master-detail-layout.empty-label', 'Select an item to open details.')
);

const uid = $props.id();
const mainId = `${uid}-main`;
let hashPath = $state('/');
let target = $state<HTMLDivElement | undefined>();

$effect(() => {
  if (path !== undefined) {
    hashPath = path;
    return;
  }
  const syncPath = () => (hashPath = currentHashPath());
  syncPath();
  return onNavigate(syncPath);
});
$effect(() => {
  if (target) mountScreen(target);
});

const current = $derived(path ?? hashPath);
const resolved = $derived(resolveNav(nav ?? { sections: [] }, current));
const masters = $derived(
  resolved.flatMap((section) => section.items) as readonly ResolvedNavItem[]
);
const selected = $derived(masters.find((item) => item.active || item.inTrail));
const detailActive = $derived(
  options?.detailActive === true || options?.detailActive === 'true' || Boolean(selected)
);
const backHref = $derived(
  nav?.brand?.href
    ? nav.brand.href.startsWith('#') || nav.brand.href.startsWith('/')
      ? nav.brand.href
      : `#${nav.brand.href}`
    : '#/'
);

function itemHref(item: ResolvedNavItem): string {
  return item.href.startsWith('#') || item.href.startsWith('/') ? item.href : `#${item.href}`;
}

function isExactActive(item: ResolvedNavItem): boolean {
  return navPath(item.href) === navPath(current);
}
</script>

<div
  class={cx('tx-app-layout', 'tx-app-layout--master-detail', className)}
  data-tx-app-layout="master-detail"
  data-detail-active={detailActive ? 'true' : 'false'}
>
  <LayoutChrome part="skip" {mainId} {nav} {skipLabel} />
  <header class="tx-app-layout__md-header">
    <LayoutChrome part="brand" {nav} />
    <div class="tx-app-layout__md-header-end">
      <LayoutChrome part="actions" {nav} />
      <LayoutChrome part="user" {nav} compact />
    </div>
  </header>
  <div class="tx-app-layout__md-body" data-tx-master-detail="">
    <section
      class="tx-app-layout__md-list"
      aria-label={typeof options?.listLabel === 'string' ? String(options.listLabel) : listLabel}
      data-tx-md-list=""
    >
      <ul class="tx-app-layout__md-items">
        {#each masters as item (item.id)}
          {@const badge = navBadge(item.badge)}
          {@const href = itemHref(item)}
          <li>
            <a
              {href}
              class="tx-app-layout__md-item"
              aria-current={isExactActive(item) ? 'page' : undefined}
              data-trail={item.inTrail ? '' : undefined}
              data-tx-md-item={item.id}
            >
              {#if item.icon}
                <span class="tx-app-layout__md-item-icon" aria-hidden="true">
                  <NavIcon icon={item.icon} />
                </span>
              {/if}
              <span class="tx-app-layout__md-item-label">{item.label}</span>
              {#if badge !== undefined}
                <span class="tx-app-layout__badge">{badge}</span>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    </section>
    <section
      class="tx-app-layout__md-detail"
      aria-label={typeof options?.detailLabel === 'string' ? String(options.detailLabel) : detailLabel}
      data-tx-md-detail=""
    >
      {#if detailActive}
        <div class="tx-app-layout__md-back-row">
          <a class="tx-app-layout__md-back" href={backHref} data-tx-md-back="">
            {typeof options?.backLabel === 'string' ? String(options.backLabel) : backLabel}
          </a>
          {#if selected}
            <h2 class="tx-app-layout__md-title">{selected.label}</h2>
          {/if}
        </div>
        <div bind:this={target} id={mainId} class="tx-app-layout__screen" tabindex="-1" role="main"></div>
      {:else}
        <p class="tx-app-layout__md-empty" data-tx-md-empty="">
          {typeof options?.emptyLabel === 'string' ? String(options.emptyLabel) : emptyLabel}
        </p>
        <!-- Keep a mount target so LayoutHost can park the outlet; visually empty. -->
        <div bind:this={target} id={mainId} class="tx-app-layout__screen tx-app-layout__screen--parked" tabindex="-1" hidden></div>
      {/if}
    </section>
  </div>
</div>
