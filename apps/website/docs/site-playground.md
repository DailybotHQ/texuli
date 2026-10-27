# Agent playground (texuli.com)

**App:** `apps/website`  
**Surface:** `src/components/playground/`, `src/pages/playground/`  
**Tests:** `scripts/tests/site-loaders.test.ts`, `tests/e2e/site-playground.spec.ts`

## Goal

Paste or edit a **catalog tree** (JSON), run the **sink-free renderer** (with
tree limits), inspect **diagnostics**, and load **hostile corpus** presets.
Static Astro page + one Svelte island. No runtime network.

## Pipeline

1. Refuse editor text whose UTF-8 length exceeds `DEFAULT_TREE_LIMITS.maxBytes`
   plus an 8 KiB whitespace allowance (`too large` error — no `JSON.parse`).
2. `JSON.parse` the editor (parse errors explained).
3. `renderCatalogTreeWithLimits` — depth/nodes/bytes/branching.
4. Sink-free `renderCatalogTree` via the playground catalog (card, badge, stat,
   non-emittable dialog chrome for hostile samples).
5. Inert **tree preview** (`textContent` only) and a diagnostics list.

## Presets

- **safe** — simple cards and stacks.
- **hostile** — every tree sample from `@texuli/catalog/render/hostile`
  (`HOSTILE_SAMPLES`).

## Validation

```bash
bash -c 'pnpm build && TEXULI_E2E_PORT=4880 pnpm exec playwright test tests/e2e/site-playground.spec.ts'
pnpm vitest run scripts/tests/site-loaders.test.ts
```

## Limits

- Preview is a structural view of `RenderNode`s, not live Texuli mounts
  (custom elements stay optional for hosts that need them).
- Tier is fixed to `untrusted` in the island (markup cannot raise it).
