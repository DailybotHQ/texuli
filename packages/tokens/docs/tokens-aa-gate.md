# AA gate for every theme

**Package:** `@texuli/tokens`  
**Source:** `packages/tokens/src/aa-gate/`  
**Tests:** `packages/tokens/tests/aa-gate.test.ts`

## Goal

Every semantic role pair of every theme and mode is checked against **WCAG 2.x**
contrast floors. **Pass/fail always uses AA:**

| Kind | Floor (pass/fail) |
| --- | ---: |
| Text (including hover/active on fill roles) | **4.5:1** |
| UI / non-text (1.4.11) | **3:1** |

When a catalog theme declares **AAA**, default-state text pairs below **7:1**
are listed as `enhancedIssues` for website pages. They do not fail the gate
(interactive hover fills are often softer than 7:1 by design).

APCA is out of scope (license). Do not treat a WCAG ratio as an APCA score.

Results are plain JSON-serializable reports for the website theme pages.

## Usage

```ts
import {
  runAaGateOnTheme,
  runLibraryAaGate,
  aaGateReportForWebsite,
  THEME_CONTRAST_PAIRS,
} from '@texuli/tokens/aa-gate';

// One theme (contract light + dark palettes)
const one = runAaGateOnTheme({
  id: 'harbor-teal',
  name: 'Harbor Teal',
  contrastLevel: 'AA',
  light: theme.light,
  dark: theme.dark,
});

// Entire lazy library (64 themes × light/dark + optional high-contrast)
const library = await runLibraryAaGate();
if (!library.pass) throw new Error(`AA gate failed: ${library.issueCount} issues`);

// Compact payload for Astro theme pages (failures only per mode)
const pageData = aaGateReportForWebsite(library);
```

## Pairs

`THEME_CONTRAST_PAIRS` (shared with the theme generator) lists every guaranteed
foreground/background role pair, including interactive hover/active states on
fill roles. `gatedSemanticRoles()` lists the roles the gate touches.

Non-hex values (CSS system colors under high-contrast / forced-colors) are
**skipped**, not failed — WCAG relative luminance is defined for sRGB hex here.

## Report shape

- `AaGatePairResult` — one pair × state (`ratio`, `required`, `pass`, optional `skipped`)
- `AaGateModeReport` — one mode (`light` | `dark` | `high-contrast`)
- `AaGateThemeReport` — one theme with its declared AA/AAA floor
- `AaGateReport` — library aggregate (`pass`, `issueCount`, `themes`)

## Testing

```bash
pnpm vitest run packages/tokens/tests/aa-gate.test.ts
```

The library suite loads all 64 themes and asserts `report.pass === true`.
