# texuli.com: live examples

**App:** `apps/website`  
**Routes:** `/examples/`, `/examples/<id>/`  
**Components:** `src/components/examples/`  
**Tests:** `tests/e2e/site-examples.spec.ts` · `scripts/tests/site-loaders.test.ts`

## Goal

Render **every registered example** from `@texuli/examples` **live**, filterable
by **package** and **kind**, each with **source** when discoverable. Real demos
(not JSON stand-ins), framed with **light/dark** and **LTR/RTL** toggles,
**lazy-mounted** on scroll (`IntersectionObserver`).

## How it works

| Piece | Role |
| --- | --- |
| `buildExampleCatalog()` | Build-time list from `listExamples()` + source file scan under `packages/examples/src` |
| `filterExampleCatalog()` | Pure query / package / kind filter |
| `ExamplesBrowser.svelte` | Index island: filters + card grid |
| `ExampleCard.svelte` | Meta, props chips, frame, host, source `<details>` |
| `ExampleFrame.svelte` | Scoped `data-tx-mode` + `dir` toggles (site theme CSS) |
| `ExampleHost.svelte` | `getExample(id).load()` when visible (or `eager` on detail) |

Package = first segment of `component` (`texuli`, `media`, `data`, …).  
Kind = first distinctive tag (not the package name / rtl / dark / a11y noise).

## Usage

```bash
pnpm build
pnpm --filter @texuli/website preview
# open /examples/ and /examples/texuli-button/
```

## Tests

```bash
pnpm vitest run scripts/tests/site-loaders.test.ts
bash -c 'pnpm build && TEXULI_E2E_PORT=4910 pnpm exec playwright test tests/e2e/site-examples.spec.ts'
```

E2E (chromium / webkit / mobile Pixel 7):

- index lists the full registry count;
- package / kind / search filters reduce the list;
- a live host mounts a real demo (button click);
- frame light/dark and LTR/RTL toggles;
- detail route eager-loads;
- no foreign HTTP(S) network;
- axe WCAG 2.1 A/AA in light, dark and forced-colors (zero exclusions).

## Budgets / performance

- Index uses one client island; each demo loads only after intersection.
- Detail routes mount a single eager example.
- Report page weight in the task outbox; do not edit `texuli.budgets.json`
  unless the lead asks. Heavy chart/data demos stay behind lazy loaders from
  the examples package itself.

## Limits

- Source text is best-effort (file containing `data-example` or `id:` match).
- Props chips list `ExampleEntry.props` names; demos own their interactive
  state (full Svelte demos, not remote-controlled prop panels).
- Primary nav may need a lead fold into docs shell / landing.
- Nested frame dark mode uses the same theme CSS as the site (`data-tx-theme`
  + `data-tx-mode` on the frame).
