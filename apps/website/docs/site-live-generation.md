# Live generation playground (texuli.com)

**App:** `apps/website`
**Path:** `/live-generation/` (Agents group, after Playground)
**Packages:** `@texuli/player` streaming mode (in development, on npm from
`0.6.0`)
**Decision:** ADR-014 (streaming generation) in
[DECISIONS](../../../docs/DECISIONS.md)
**Tests:** `apps/website/tests/site-live-generation.test.ts`,
`tests/e2e/site-live-generation.spec.ts`

## Goal

Let a reader watch a blueprint paint while it streams, and see what the
player does when a node is refused or the connection drops, without a
model, a key or a network request.

## How it works

- `src/components/live-generation/recording.ts` holds three recorded
  drafts as static data: the agent service's recorded weekly report (its
  first preset prompt in `apps/agent/src/demo.ts`, grown by a chart), the
  same report with one node outside the catalog (`script-runner`), and the
  report with a scheduled drop at 55 % of the chunks. Each is one envelope
  in the shape the agent service streams (header first, children last),
  cut into chunks by a fixed pattern (7, 13, 4, 19, 9, 23, 5, 11, 16, 3
  characters), so every replay is the same.
- `replay.ts` is the source: an `AsyncIterable<string>` the page controls
  (play, pause, one chunk, a speed read before every chunk, interrupt). A
  drop or an interrupt makes the iterator throw, which the player reads as
  a stopped connection.
- `LiveGeneration.svelte` passes the replay to `<Player stream>` with
  `onStreamProgress` (phase, painted, held, bytes, shown next to the
  controls and in a short "What happened" list) and `onStreamRetry` (Try
  again starts a new replay of the same draft, without the drop).

## What the reader sees

| Draft | Result |
| --- | --- |
| A weekly report | Skeletons for pending nodes, nodes painted as they complete, a busy and inert surface, then a valid draft. |
| A node outside the catalog | The node is held with a static note (its props never paint) while the rest paints; the final verdict refuses the draft and shows the refusal notice. |
| A dropped connection | Painted nodes stay, the rest says it was not received, an alert offers Try again, and the retry completes. |

Reduced motion: the system setting or the page checkbox sets the
player's `motion` to `reduce` (the root carries `data-tx-motion="reduce"`),
and the page's own transitions run only without it. Skeletons never
animate.

## Performance

The island mounts with `client:visible` and imports `@texuli/player` on
the first Start, so the first paint carries the controls and the recorded
text only. Route budget: `src/components/perf/budgets.ts`.

## Validation

```bash
pnpm vitest run apps/website/tests/site-live-generation.test.ts
pnpm build
pnpm --filter @texuli/website check:csp
TEXULI_E2E_PORT=4959 pnpm exec playwright test tests/e2e/site-live-generation.spec.ts --project chromium
```

## Limits

- The page replays recordings; it never calls the agent service, which is
  in the repository and not deployed.
- Resuming a stream from a byte offset is not supported by the player; a
  retry streams the draft from the start.
