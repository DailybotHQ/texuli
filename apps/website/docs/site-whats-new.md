# What's new hub (texuli.com)

**App:** `apps/website`
**Path:** `/whats-new/` (Get started group, after the guides; linked from
the home page hero)
**Data:** `src/components/whats-new/features.ts` (`RELEASES`, `FEATURES`)
**Tests:** `apps/website/tests/site-whats-new.test.ts`, `tests/e2e/site-whats-new.spec.ts`

## Goal

Every new package and capability of `0.6.0` to `0.16.0` on one page
(PLAN_010 Amendment 8, PLAN_011 T-site-090 and T-site-0100), grouped by
release with the status the repository states: `0.6.0` to `0.16.0` are
published on npm, and `0.17.5` is current (pre-1.0), the published line of
`docs/RELEASE.md`. `0.11.0` (Protoyard G125–G127 and the Final Review
fixes, with its patches `0.11.1` to `0.11.5`), `0.12.0` (Protoyard
G136: the `@texuli/pages` core entries without the deck model, with its
patches `0.12.1` to `0.12.3`), `0.13.0` (the consumer gaps: blueprint
spec `0.11.0` and one label dictionary, with its patch `0.13.1`: icon
registration, `CodeField`, a theme-aware dark image and grid avatar
groups), `0.14.0` (the Protoyard and Dailybot consumer gaps: blueprint
spec `0.12.0` with timeline groups, markers and selection, `aa-non-text`,
`MotionLoop` and lazy icons, with its patches `0.14.1`: custom calendar
event content, a month overflow button, collapsible board lanes and board
cell footers, `0.14.2`: the backdrop of a dialog mounted open, popover
focus handoff, controlled toggles, timeline day ticks and an opening date,
new component props and CSS hooks, and `0.14.3`: control, navigation,
layout, chat and slides options, `ListItem` and opt-in Spanish label
catalogs, and `0.14.4`: the timeline holds its opening day as rows arrive
and zoom changes, and `scrollToDate`), `0.15.0` (locked design systems:
blueprint spec `0.13.0` with `allow`, `library` and `approval`, catalog axes,
states and host extensions, typography components and button tone) and
`0.16.0` (the design-system kit, `ds generate` and the importers, the full
locked checks, bundles and the contract schemas released; blueprint spec
`0.14.0` with the category `color` axis; `VirtualListView`, `Mark`, `Link`,
`ColorSwatch` and `List`, and `0.16.1`: host catalog extensions in `ds check`
and `ds validate`, compound parts, unscanned prototype imports and the
`VirtualListView` feed mode) and `0.17.0` (the Protoyard adoption fixes:
blueprint spec `0.15.0`, generator, bundles, the locked render check, the
kit and `VirtualListView`) are listed with their status and no cards; their details are on `/changelog/`. The unit test requires the current release's status to
say so, and a version in development (when the release line names one) to
be marked as such. Each feature has a small demo or a preview and a link
to its full page.

## Cards

| Release | Feature | Demo or preview |
| --- | --- | --- |
| 0.10.0 | Design systems | The three example brands' contrast pairs passing in light and dark, from `checkDesignSystem` at build time; links `/design-systems/` |
| 0.10.0 | Design system studio | Static card linking `/theme-studio/` |
| 0.10.0 | Design system tools for agents | Three `texuli ds` commands; links `/design-systems/#start` |
| 0.10.0 | Conformance | The `texuli ds check --render` command; links `/design-systems/#conformance` |
| 0.10.0 | More fixes from Protoyard (G100–G124) | Static card linking `/changelog/` |
| 0.10.0 | Removed after one minor | The removed MCP tool count from the generated MCP data; links `/mcp-server/#versions` |
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
