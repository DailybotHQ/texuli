# Motion page (texuli.com)

**App:** `apps/website`
**Path:** `/motion-page/` (Components group, after Drag and drop)
**Packages:** `@texuli/core/motion`, `@texuli/tokens/motion`, `texuli/motion`,
`@texuli/player` (node motion), `@texuli/data/board`; all of it in
development, shipping in `0.6.0` (spec `0.6.0` is unreleased)
**Decision:** [ADR-013](../../../docs/DECISIONS.md#adr-013-motion-runtime-web-animations-with-an-owned-spring-solver)
**Tests:** `apps/website/tests/site-motion.test.ts`, `tests/e2e/site-motion.spec.ts`

## Goal

Show the motion system working end to end: the runtime texels, the styled
components that adopt them, the tokens, the levels and reduced motion, and
motion as blueprint data painted by the player. One settings panel drives
every demo, so a reader sees the same code play or commit at once.

## Layout

| Section | Island | What it shows |
| --- | --- | --- |
| Hero | static | Status (in development, ships in `0.6.0`; npm has `0.5.0` without it) and the texels as pieces. |
| `#settings` | `MotionConsole.svelte` | Level (`full`, `subtle`, `none`) as a radio group, a reduced-motion override, the reader's system setting (`createReducedMotionSource`), the duration tokens at the chosen level, and a staggered sample that reports its outcome (`Played: finished`, `Instant: reduced-motion`, `Instant: level-none`). |
| `#presence` | `PresenceDemo.svelte` | `Dialog`, `Sheet` and a contained `Toaster` under one `MotionProvider`; the enter, exit and duration selects are the closed spec names. |
| `#layout` | `LayoutList.svelte`, `BoardDemo.svelte` | A keyed list on `createListMotion` (move up and down, remove, add, shuffle, sort; focus stays on the moved item) and the `@texuli/data` Board (drag, keyboard, Move menu, or "Advance a card"). |
| `#shared` | `SharedDemo.svelte` | `createSharedElements`: a card's preview grows into the detail view and back; focus moves with the view. |
| `#timeline` | `TimelineDemo.svelte` | `timeline`, `parallel`, `stagger`: play, pause, reverse, seek, the stagger origin and offset. |
| `#springs` | `SpringsDemo.svelte` | The three spring tokens plotted from `springSamples` (server-rendered SVG; solid, dashed and dotted lines with a text legend) and played with `animate(…, { spring })`. |
| `#tokens` | `TokensExplorer.svelte` | Durations, easings and springs with their `--tx-motion-*` properties in `Tabs` (the indicator glides), each playable on one preview track. |
| `#blueprint` | `BlueprintDemo.svelte` | The blueprint JSON (static), and the real `<Player>` at the `untrusted` tier: a toggle in the blueprint's local state makes three cards enter, staggered, and a risk card scale in and fade out. The hostile variant (`enter: "spin"`, raw keyframes) paints in `preview` without motion and lists the `invalid-motion` diagnostic. |
| `#rules` | static | The rules the runtime keeps by construction, and two code samples. |
| `#api-contract` | static | The one API contract: rest attributes and `ref`, composed handlers, callback naming, the Field rule, providers, the motion prop; what `0.5.0` shipped and what `0.6.0` adds. |
| `#package-docs` | static | Repository paths of the package docs. |

Copy lives in `src/components/motion-site/page.ts`, the blueprints in
`blueprint.ts` and the plot data in `springs.ts` (fictional Harbor Notes
content; labels are text, never HTML).

## Shared settings

`settings.svelte.ts` holds one `$state` object (`level`, `reduced`). Astro
islands are separate Svelte roots but load the module once per page, so they
share it. Styled components read it through `MotionProvider`
(`reducedMotion` is `true` when the override is on, else `undefined`, which
follows the system); a component that animates in the same component that
would render the provider passes `pageMotionSettings` as the seam's
`settings`; the runtime demos pass `runtimeTiming()` to the texels.

## Information architecture: the API contract

The contract is a section of this page (`#api-contract`), with a search
entry ("Component API contract") pointing at it. Motion is one prop of that
contract and both ship in `0.6.0`. A guide page would need a new
`GUIDES_SECTIONS` entry, and `scripts/tests/site-loaders.test.ts` pins the
guide list; moving the section to a guide is a follow-up if the guides grow
a reference section.

## Performance

Every island mounts with `client:visible`; only the settings panel is near
the first screen. Route budget: `src/components/perf/budgets.ts`.

## Validation

```bash
pnpm vitest run apps/website/tests/site-motion.test.ts
pnpm build
pnpm --filter @texuli/website check:csp
TEXULI_E2E_PORT=4955 pnpm exec playwright test tests/e2e/site-motion.spec.ts --project chromium
```

## Limits

- The reduced-motion checkbox is a page override; it does not change the
  system setting. With it off, the page follows `prefers-reduced-motion`.
- The spring tracks and the tokens preview move along the physical x axis
  (a demo track, not text flow).
- Shared-element transitions between styled components and springs in the
  motion prop are planned (`packages/texuli/docs/ui-motion.md`); the demo
  uses the runtime texel directly.
