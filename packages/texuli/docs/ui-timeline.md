# Timeline

**Package:** `texuli` · **Import:** `texuli/timeline` or `texuli`

A styled timeline on the token contract: an ordered list of dated items,
vertical or horizontal, with a marker per item and a line joining them. It is
ported in spirit from Protoyard's `TimelineBlock` (blocks-ui), with:
- status per item;
- composition;
- translatable words;
- the URL policy;
- logical CSS.

Protoyard's `@protoyard/ui` has no Timeline.

| Component | Role |
| --- | --- |
| `Timeline` | The `<ol>`. Data-driven with `items`, or composed from `TimelineItem` children |
| `TimelineItem` | One `<li>`: marker, `<time>`, title (optionally a link), description, extra content |

## Usage

```svelte
<script lang="ts">
  import { Timeline, TimelineItem } from 'texuli/timeline';
</script>

<Timeline
  label="Project milestones"
  items={[
    { time: 'Mar 4', datetime: '2026-03-04', title: 'Kickoff', status: 'complete', tone: 'success' },
    { time: 'Mar 18', title: 'Design review', status: 'current' },
    { time: 'Apr 1', title: 'Private beta', href: 'https://example.com/beta', status: 'upcoming' },
  ]}
/>

<Timeline label="Incident" orientation="horizontal">
  <TimelineItem title="Alert fired" time="09:12" tone="destructive" status="complete">
    {#snippet icon()}<MyIcon />{/snippet}
    <p>Paged the on-call engineer.</p>
  </TimelineItem>
  <TimelineItem title="Mitigated" time="09:40" tone="success" status="current" />
</Timeline>
```

## Props

**`Timeline`**, plus any `<ol>` attribute:

| Prop | Default | |
| --- | --- | --- |
| `items` | — | `{ id?, time?, datetime?, title, description?, href?, tone?, status? }[]` |
| `orientation` | `vertical` | `vertical` or `horizontal` (`TIMELINE_ORIENTATIONS`) |
| `label` | `messages.label` ("Timeline") | The list's accessible name |
| `messages` | English | `{ label, complete, current, upcoming }`; blank strings fall back |
| `hrefTrust` | `developer` | URL policy tier for item links: `untrusted` for agent or user content |
| `item` | — | Snippet `(item, index)` rendered inside each data-driven item |
| `class` | — | Merged last |

**`TimelineItem`**, plus any `<li>` attribute: `title` (required), `time`,
`datetime`, `description`, `href`, `tone`, `status`, `icon` (snippet), and
children (extra content).

## Variants and states

- **Orientation:** `vertical`, with the line down the marker column, or
  `horizontal`, with the line along the marker row. A horizontal timeline
  scrolls sideways and takes a Tab stop (`tabindex="0"`) so the keyboard can
  scroll it.
- **Tone** (`TIMELINE_TONES`): `default`, `success`, `warning`, `destructive`,
  `info`, `neutral`. Tone is color only.
- **Status** (`TIMELINE_STATUSES`). Each status is a marker shape and a spoken
  word, never color alone:

  | Status | Marker | Spoken | Also |
  | --- | --- | --- | --- |
  | `complete` | filled, with a check | "Completed" | |
  | `current` | filled, with a ring | "Current" | `aria-current="step"` |
  | `upcoming` | hollow | "Upcoming" | its line to the next item is dashed |

  No status draws a filled marker with no word.

## Accessibility

- An `<ol>` named by `label`; each item is a `<li>`. Markers are `aria-hidden`.
- Time is a `<time>`, with `datetime` when you pass a machine-readable value.
- Item links pass `safeHref` with the timeline's `hrefTrust`. A rejected
  `href` (for example `javascript:`) renders the title as plain text, never as
  an inert link.
- **Contrast.** Muted text (time, description) uses `--tx-muted-foreground`.
  Without tokens it falls back to a `CanvasText`/`Canvas` mix that stays AA;
  `GrayText` does not in every browser.
- **Forced colors.** Markers and lines use `CanvasText` and `Highlight`, and
  the text uses `CanvasText`.
- **Right to left.** Logical properties only: the marker column, the lines and
  the horizontal order all mirror. A unit test fails on any physical property
  in `timeline.css`.

The example `texuli-timeline` was checked with axe (WCAG 2.1 A/AA) in light
and dark, with and without forced colors, on Chromium, WebKit and Pixel 7:
0 violations. The right-to-left geometry was checked in the browser too.
These were one-off runs; no committed spec sweeps examples with axe yet.

## Styles

- Styles live in `@layer tx.components`, so a consumer class wins. Import
  `@texuli/tokens/base.css` once at the app root.
- Custom properties, set on `.tx-timeline` or an item:
  - `--tx-timeline-marker` (1rem);
  - `--tx-timeline-line` (2px);
  - `--tx-timeline-gap` (1.5rem);
  - `--tx-timeline-tone` and `--tx-timeline-tone-foreground`.

## Size

`texuli/timeline` is 2,625 B gzip (2,306 B brotli) with 1.24 KiB of CSS
(`pnpm exec tsx scripts/size.ts --filter texuli/timeline`, 2026-10-24). Its
budget is the default `texuli/*` pattern, 12 KiB.

## Tests

```bash
pnpm vitest run packages/texuli/tests/display.test.ts packages/texuli/tests/contracts.test.ts
```

Fifteen tests cover:
- structure and naming;
- `<time datetime>`;
- both orientations;
- every tone × status;
- spoken status words and `aria-current`;
- translations;
- the URL policy in both tiers;
- class merging;
- composition and the `item` snippet;
- standalone items;
- the CSS layer, logical properties only, and the forced-colors block.
