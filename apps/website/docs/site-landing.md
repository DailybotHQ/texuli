# texuli.com library landing

**App:** `apps/website`  
**Page:** `/`  
**Components:** `src/components/landing/`  
**Task:** FIX-site-landing

## Layout

The home page does **not** use the docs sidebar. It uses `BaseLayout` with
`fullBleed` and the shared `SiteHeader` (slim header; docs shell lives on guide
routes via FIX-site-sidebar-nav).

## Sections (top to bottom)

1. Announcement banner → guides  
2. Hero: “Interfaces from texels.” + Start building / Browse components  
3. Interactive hero moments (one island): media, climate, team, tasks, chart, date  
4. Three feature cards (owned / accessible / agents)  
5. Agents path + safe renderer playground  
6. Themes strip (same-origin CSS apply)  
7. Footer: llms.txt, skill, changelog, MIT (Dailybot, Inc.)

## Illustrations

`SiteIllustration` + `src/data/illustrations.json`. Files optional under
`public/illustrations/<file>.webp`. Missing files render a token gradient
fallback (width/height, lazy, async decode, alt required).

## Gates

- `pnpm build` (website)
- `tests/e2e/site-landing.spec.ts`
- `a11y-site` and `site-perf` (route budget for `/` with reason)
