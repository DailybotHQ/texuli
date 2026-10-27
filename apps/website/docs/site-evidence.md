# texuli.com: Evidence on every component page

**App:** `apps/website`  
**Paths:** `/evidence/`, evidence strip on `/component-pages/<id>/`  
**Surface:** `src/components/evidence/`, `src/pages/evidence/`  
**E2E:** `tests/e2e/site-evidence.spec.ts`  
**Unit:** `scripts/tests/site-loaders.test.ts`

## Goal

Show **behavior checks**, **gzip size**, **axe**, and **browser matrix** on every
component page from the latest committed gates. Static HTML after build. No
runtime network. Axe clean in light and dark on desktop and Pixel 7.

## What each strip includes

| Field | Source |
| --- | --- |
| Behavior | The scenario in `tests/behavior/scenarios/<name>` when one maps to the id, with its check count; else n/a |
| Size | `texuli.budgets.json` budget + optional measured gzip from `docs/quality/perf-primitives.md` |
| Axe | Documented suites (`site-component-pages` e2e, `docs/quality/a11y-*`) |
| Browsers | Playwright projects: chromium, webkit, mobile (Pixel 7) |

Snapshots are dated (`EVIDENCE_AS_OF`). They are not live CI polling.

## Components

| File | Role |
| --- | --- |
| `types.ts` | Evidence shape |
| `budgets.ts` | Read gzip budgets from repo `texuli.budgets.json` |
| `behavior-map.ts` | Map catalog ids → behavior scenarios, and count their checks |
| `load-evidence.ts` | Resolve evidence for one component |
| `EvidencePanel.astro` | UI strip (Card grid) |

`ComponentPageBody.astro` includes `EvidencePanel` after Accessibility.

## Validation

```bash
pnpm vitest run scripts/tests/site-loaders.test.ts
bash -c 'pnpm build && TEXULI_E2E_PORT=4930 pnpm exec playwright test tests/e2e/site-evidence.spec.ts'
```
