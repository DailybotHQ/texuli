# Notification inbox

**Package:** `@texuli/data`  
**Lazy subpath:** `@texuli/data/activity/inbox` (also `NotificationInbox` from `@texuli/data`)  
**Engine:** `packages/data/src/engines/activity/inbox.ts` (also `@texuli/data/activity/engine`)  
**View:** `packages/data/src/activity/inbox/`  
**Tests:** `packages/data/tests/inbox.test.ts`  
**Example:** `data-inbox`

## Goal

A notification inbox: unread state with a count, mark one read or unread, mark
all read, an all/unread view, per-item actions and a polite announcement when
new unread items arrive. The read state belongs to the host; the inbox reports
changes through `onReadChange`, and the pure helpers apply them.

## Usage

```svelte
<script lang="ts">
  import { type InboxNotification, NotificationInbox, setRead } from '@texuli/data/activity/inbox';

  let items = $state<InboxNotification[]>(loadNotifications());
</script>

<NotificationInbox
  {items}
  now={clock.now()}
  onReadChange={(ids, read) => (items = setRead(items, ids, read))}
>
  {#snippet actions(item)}
    <button type="button" aria-label={`Archive: ${item.title}`} onclick={() => archive(item.id)}>Archive</button>
  {/snippet}
</NotificationInbox>
```

## Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `items` | required | `InboxNotification[]` newest first: `id`, `title` (plain text), `body?`, `at` (ISO, ms or `Date`), `read`, `href?`; extra fields ride along |
| `now` | required | The runtime clock, for the time labels ("Today, 9:00 AM") |
| `timeZone`, `locale` | `UTC`, `en-US` | Time label formatting |
| `filter` | `all` | `bind:filter`: `all` or `unread`. `onFilterChange` |
| `onReadChange` | none | `(ids, read)` from an item's toggle, opening an unread item, or Mark all as read |
| `onOpen` | none | Opening an item from its title (a link with `href`, else a button when `onOpen` is set) |
| `allowMarkUnread` | `true` | Read items offer "Mark unread". `false` hides that toggle (unread items still offer "Mark read"), for hosts that persist only mark-read |
| `onMarkUnread` | none | `(ids)` after `onReadChange` when an item is marked unread, for hosts that store it separately |
| `markReadOnOpen` | `true` | Opening an unread item also marks it read |
| `hrefTrust` | `untrusted` | URL policy tier for `href` (`safeHref`): `untrusted` allows `https:`, `mailto:` and `#fragment` links; `developer` also allows app routes such as `/deals/1`. A refused link renders as plain text |
| `actions`, `body` | none | Snippets: per-item actions after the read toggle, and a custom body under the title |
| `headingLevel` | `2` | Level of the inbox heading (2–6) |
| `labels` | English | Every visible and announced string (`resolveInboxLabels`) |

## Behavior

- **Structure:** a `section` named by its heading ("Notifications"); the unread badge shows the number and reads ", 3 unread". Items are a list of `article`s named by their titles.
- **Unread:** a dot and bold title show it, and "Unread:" is read before the title, so it never depends on color.
- **Toggle:** each item has a visible "Mark as read" / "Mark as unread" button whose name starts with that text ("Mark as read: Export ready", WCAG 2.5.3).
- **Mark all as read** uses `aria-disabled` when nothing is unread, so it keeps focus instead of dropping it.
- **Unread view:** items read while it is open stay listed until the view changes, so the focused control never disappears.
- **Arrivals:** when the host adds items the inbox has not seen, a polite live region says "1 new notification." (the first render says nothing).
- Titles and bodies are text, never markup.

## Engine

`unreadCount(items)`, `setRead(items, ids, read)`, `markAllRead(items)`,
`filterInbox(items, filter)` and `newArrivals(seen, items)` are pure and
framework-free; `setRead` keeps the identity of items it does not change.

## Verified

- `pnpm vitest run packages/data/tests/inbox.test.ts`: **4 tests**: the pure helpers; `allowMarkUnread={false}` hiding the toggle on read items and `onMarkUnread` reporting a mark-unread (G50); the heading count, unread text, `datetime`, the URL policy at both tiers, toggle names and state, open marks read, the unread view keeping items and focus, mark all and its `aria-disabled`, item actions, the arrival announcement, and a `javascript:` link and markup title rendered as text.
- In the browser (a scratch spec on port 4937): the `data-inbox` example, after a simulated arrival, passes axe in light, dark and forced colors on Chromium, WebKit and the Pixel 7.

## Limits

- No grouping by day, pagination or swipe actions; long inboxes should page on the host.
- The inbox does not persist anything: apply `onReadChange` and save it yourself.
