# NavigationMenu primitive

`@texuli/primitives/navigation-menu` is headless site navigation with flyout
panels, an optional shared viewport and an indicator. It follows the
[APG disclosure navigation pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/):
- a `nav` landmark;
- triggers are buttons with `aria-expanded` and `aria-controls`;
- panels are plain content, not menus, so links keep their link semantics.

Its parts are composed as `NavigationMenu.*`. Added by T-prim-navigation-menu.

```svelte
<script lang="ts">
  import { NavigationMenu } from '@texuli/primitives/navigation-menu';

  let value = $state('');
</script>

<NavigationMenu.Root aria-label="Main" bind:value>
  <NavigationMenu.List>
    <NavigationMenu.Item value="products">
      <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
      <NavigationMenu.Content>
        <NavigationMenu.Link href="/analytics">Analytics</NavigationMenu.Link>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
    <NavigationMenu.Item>
      <NavigationMenu.Link href="/pricing" active>Pricing</NavigationMenu.Link>
    </NavigationMenu.Item>
    <NavigationMenu.Indicator />
  </NavigationMenu.List>
  <NavigationMenu.Viewport />
</NavigationMenu.Root>
```

## Parts

| Part | Renders | Notes |
| --- | --- | --- |
| `Root` | `nav` | `bind:value` (the open item, `''` for none), `onValueChange`, `delayDuration` (200), `skipDelayDuration` (300), `orientation` (`horizontal`), `dir`. Pass `aria-label` to name the landmark. `data-state`, `data-orientation`. |
| `List` | `ul` | The top-level row. |
| `Item` | `li` | `value` (generated when omitted). `data-state`. |
| `Trigger` | `button` | `aria-expanded`, `aria-controls`, `data-state`, `disabled`. The `child` snippet composes its props onto your element. |
| `Content` | `div role="group"` labelled by its trigger | Renders after its trigger, or inside `Viewport` when one is present. `data-state`, `data-motion` (`from-start` or `from-end`, from item order). |
| `Link` | `a` | `href` through `safeHref` (tier `hrefTrust`, default `developer`); an unsafe href renders no `href` and gets `data-href-blocked`. `active` sets `aria-current="page"`. `onSelect(event)` runs on click, and choosing a link closes the item unless the handler calls `event.preventDefault()`. Supports a `child` snippet. |
| `Viewport` | `div` | Renders the open content in one place, for a shared animated panel. It sets `--tx-navigation-menu-viewport-width` and `--tx-navigation-menu-viewport-height` from the content's size. |
| `Indicator` | `div aria-hidden` | Follows the open trigger: `--tx-navigation-menu-indicator-offset` and `--tx-navigation-menu-indicator-size` along the list axis. `data-state` is `visible` or `hidden`. |

`createNavigationMenuController` and `motionBetween` expose the framework-free
state machine (timing, stickiness, controlled sync).

## Behavior

- **Pointer:**
  - Hovering a trigger with a mouse opens its item after `delayDuration`.
  - While one item is open, and for `skipDelayDuration` after one closes,
    hovering another trigger switches at once.
  - Leaving the trigger and its content closes a hovered item after 150 ms;
    entering the content cancels that.
  - Touch never opens on hover.
- **Click and tap:** a click toggles. An item opened by a click stays open when
  the pointer leaves, and a click on a hover-opened trigger makes it stay.
- **Keyboard:**
  - Every top-level trigger and link is a Tab stop. The arrow keys move
    between them, wrapping; they flip in RTL, and Home and End jump to the
    ends.
  - Enter and Space toggle an item. ArrowDown (ArrowRight when vertical) moves
    into the open content.
  - Tab from an open trigger enters its content. Tab and Shift+Tab move
    through the content's links, and past either end return to the trigger or
    move on to the next control. This also works when the content renders in
    the viewport, and in engines that skip links on Tab (macOS WebKit).
  - Escape closes the item and returns focus to its trigger.
- **Dismissal:** pressing outside the navigation, focus leaving it, or focus
  moving to another item closes the open item. The menu is non-modal: no
  focus trap, no scroll lock, no `inert`.

## Size

Measured with `pnpm size` (gzip -9, Svelte external) on 2026-10-23 (the entry is 8.40 KiB on 2026-10-24):

| Measure | Size |
| --- | ---: |
| Entry with the texels it uses (`keyboard`, `tabbable`, `dismiss`, `url-policy`, `dir-locale`), which apps share across primitives | 8.31 KiB (budget 20 KiB) |
| Its own code, with `@texuli/core` external | 4.63 KiB |

## Behavior

`tests/behavior/scenarios/navigation-menu.spec.ts` has 13 rows, passing on
Chromium, WebKit and the Pixel 7. Among them:

| Row | Behavior |
| --- | --- |
| `click-toggles` | A click toggles an item, as the APG disclosure pattern expects. |
| `touch-tap-toggles` | Taps and clicks toggle. |
| `unsafe-href-blocked` | A `javascript:` href is refused by the URL policy. |

axe reports no violations with an item closed or open, in all three projects.

## Limits

- No nested submenus (`Sub`) yet.
- The viewport renders only the open content: there is no exit animation of
  the previous panel, and `data-motion` marks only the entering one.
