# What's new hub (texuli.com)

**App:** `apps/website`
**Path:** `/whats-new/` (Get started group, after the guides; linked from
the home page hero)
**Data:** `src/components/whats-new/features.ts` (`RELEASES`, `FEATURES`)
**Tests:** `apps/website/tests/site-whats-new.test.ts`, `tests/e2e/site-whats-new.spec.ts`

## Goal

Every new package and capability of `0.6.0` to `0.9.0` on one page
(PLAN_010 Amendment 8, PLAN_011 T-site-090), grouped by release with the
status the repository states: all four are published on npm, and `0.9.0`
is current (pre-1.0), the published line of `docs/RELEASE.md`; the unit
test requires the current release's status to say so, and a version in
development (none today) to be marked as such. Each feature has a small demo or a preview and a link
to its full page.

## Cards

| Release | Feature | Demo or preview |
| --- | --- | --- |
| 0.9.0 | Texuli MCP | The two doors (the remote URL and the npx command) from the generated MCP data |
| 0.9.0 | An agent-ready site, scoped portals, fixes from Protoyard | Static cards linking `/developers/`, `/tokens/#scope` and `/changelog/` |
| 0.9.0 | Design tokens v2 | The system and component token counts, read from the registries at build time |
| 0.8.0 | Canvas | The agent board as an SVG image (`canvasToSvg` at build time, a `data:` URL) |
| 0.8.0 | Data sources | A `$source` binding |
| 0.8.0 | Spreadsheets | `HubSheet.svelte`: a formula over the order log |
| 0.8.0 | Forms | `HubForm.svelte`: a two-field `SchemaForm` |
| 0.8.0 | Dashboards | `HubDashboard.svelte`: three widgets, keyboard moves |
| 0.8.0 | Email, print and PDF | `EmailFrame.svelte`: the sandboxed email on request |
| 0.8.0 | One message catalog | `HubLocale.svelte`: a Rating under the pseudo-locale |
| 0.7.0 | Documents, the page editor | Markdown imported at build time; the slash menu's block count |
| 0.6.0 | Motion | `HubMotion.svelte`: any preset through the runtime |
| 0.6.0 | One API contract, live generation, the agent service | Code samples and the paint steps; the agent service is an app in the repository, not deployed |

The static previews come first in the 0.8.0 row, so no demo's JavaScript
loads before the ready signal. `HubLocale` sets the context with
`I18N_CONTEXT` directly (what `setI18nContext` does): importing the `texuli`
root there hoisted about 30 KB of component CSS into the page.
