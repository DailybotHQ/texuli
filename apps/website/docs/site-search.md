# Site search (texuli.com)

**App:** `apps/website`  
**Surface:** `src/components/search/`, `src/pages/search/`  
**Tests:** `scripts/tests/site-search.test.ts`, `tests/e2e/site-search.spec.ts`

## Goal

A **static** search index over:

- site pages
- docs-shell pages
- components
- themes (full library metadata)
- curated examples

…with a **⌘/Ctrl+K** command palette (`texuli/command` `CommandPalette`). No
runtime network: the corpus is compiled into the client island.

## Components

| File | Role |
| --- | --- |
| `types.ts` | `SearchEntry` / `SearchHit` |
| `index-data.ts` | Frozen `SEARCH_INDEX` |
| `search.ts` | Pure `searchSiteIndex` ranking |
| `SiteSearch.svelte` | Trigger + palette island |

## Page

`/search/` — browse groups, optional `?q=` server-rendered hit list, palette
trigger. Header also mounts `SiteSearch` site-wide.

## Validation

```bash
bash -c 'pnpm build && TEXULI_E2E_PORT=4880 pnpm exec playwright test tests/e2e/site-search.spec.ts'
pnpm vitest run scripts/tests/site-search.test.ts
```

## Limits

- Theme and example hits deep-link to `/search/?q=…` rather than per-theme
  gallery routes (those pages may land in later tasks).
- Index is curated/static; it does not crawl Markdown at build time.
