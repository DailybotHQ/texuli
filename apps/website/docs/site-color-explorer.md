# texuli.com: Color and token explorer

**App:** `apps/website`  
**Page:** `/color-explorer/`  
**Components:** `src/components/color-explorer/`  
**Tests:** `tests/e2e/site-color-explorer.spec.ts`, `scripts/tests/site-loaders.test.ts`

## Goal

Explore any library theme’s:

- **OKLCH scales** (11-step primary / accent / secondary ramps)
- **Semantic roles** (~40 fills)
- **WCAG 2.x contrast pairs** (text 4.5:1 or 7:1 AAA, UI 3:1)
- **Export** as CSS custom properties, JSON, or a Tailwind-oriented map

Static after build. Theme CSS is inlined (same as the theme gallery). No runtime network. Axe clean in light and dark (the page sweep).

## Components

| File | Role |
| --- | --- |
| `build.ts` | Build-time explorer payloads via `@texuli/tokens` |
| `export-formats.ts` | Pure CSS / JSON / Tailwind string builders |
| `ColorExplorer.svelte` | Island: theme list, mode, scales, roles, pairs, copy |

## Validation

```bash
pnpm vitest run scripts/tests/site-loaders.test.ts
bash -c 'pnpm build && TEXULI_E2E_PORT=4930 pnpm exec playwright test tests/e2e/site-color-explorer.spec.ts'
```
