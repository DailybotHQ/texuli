# Screen-reader transcripts: website (accessibility-tree pass)

**Task:** `T-90` (PLAN_006)  
**Pages:** the landing (`/`), the native landing (`/native/`), the
architecture page (`/web-and-native/`), one guide (`/guides/accessibility/`)
and two studios (`/theme-studio/`, `/playground/`)  
**Build:** `pnpm build` of `apps/website`, served from `apps/website/dist` by a
small static server on `127.0.0.1:4990`  
**Date:** 2026-10-26

## Method

**No screen reader was run for this pass.** Unlike
[sr-transcripts.md](sr-transcripts.md) and
[sr-transcripts-slides.md](sr-transcripts-slides.md), these are not VoiceOver
phrasing. They are readings of the **accessibility tree** of the built site,
taken on 2026-10-26 with:

1. Playwright `locator('body').ariaSnapshot()` on desktop Chromium (light,
   reduced motion), after `networkidle` and a 500 ms settle.
2. A DOM walk of the same page for the heading outline and the landmarks.
3. Sixty Tab presses from the top of the page, recording the focused element's
   tag, role and name (the tab order below).

The "Reading order" lists say what the tree exposes, in order: role, name,
value and state. They are **not** a recording or a reconstruction of what
VoiceOver, NVDA or JAWS speaks; verbosity, rotor labels and phrasing are not
measured here. The tree is what a screen reader consumes, so a wrong name,
role, value, outline or order in it is a real defect; a correct tree does not
prove the spoken experience. A live VoiceOver pass on Safari remains a release
check for these pages.

The capture helper was a temporary local spec (`tmp/t90-capture/`) and is not
in the repository. To re-read a tree, build the site, serve `apps/website/dist`
on a lane port (never 4870, never the developer's `:4321` dev server), and run
`locator('body').ariaSnapshot()` or open the browser's accessibility panel.

Names, roles and contrast are also checked automatically by
`TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/a11y-site.spec.ts --project chromium`
(axe, zero exclusions); the page-layer fixes from this pass are pinned by
`pnpm vitest run apps/website/tests/a11y-sr-pass.test.ts`.

## Shared site chrome

Every page starts with the same chrome; the walks below omit it.

| Stop | Tree |
| --- | --- |
| First Tab stop | link "Skip to content" (to `#main`) |
| Banner | link "Texuli home" (image "Texuli"); button "Search the site" (the visible ⌘K hint is not part of the name); group "Appearance" with toggle buttons "Light", "Dark", "System" (pressed) |
| Docs pages and studios | navigation "Primary" (the site sidebar), before `main` |
| Landing and native | link "Docs", navigation "Platform" ("Web + native", "Native"), link "GitHub", link "Get started" in the banner |
| Footer | contentinfo with navigation "Footer" (two lists of links) and the license line |

The Appearance group is one Tab stop (the pressed button); the arrow keys move
inside it.

---

## 1. Landing (`/`)

**Title:** "One component catalog for web and native · Texuli", `lang="en"`.

### Heading outline

- h1 "Interfaces from texels."
  - h2 "210 themes, one engine"
  - h2 "Why Svelte for the web" — h3 "The web story", "The ladder: texels to components", "The guarantees"
  - h2 "One line in, two languages out" — h3 "What moves today", "Planned"
  - h2 "Built for agents, too" — h3 "From catalog to interface", "What agents can read here", "One platform, two runtimes. Start today."

### Landmarks

banner (with navigation "Platform") · main, holding regions "Interfaces from
texels.", "Why Svelte for the web", "One line in, two languages out", "Built
for agents, too" · contentinfo (navigation "Footer"). Each scrollable code
excerpt is a focusable region named for its file (for example "Repository
excerpt from packages/core/src/roving/roving.ts"), so it can be reached and
scrolled from the keyboard.

### Reading order

1. Region "Interfaces from texels.": eyebrow "One catalog · web and native";
   heading level 1; the lead; links "Start building", "See the native story";
   list "Texuli by the numbers", 3 items: links "133 catalog components",
   "41 owned primitives", "161 examples".
2. Heading level 2 "210 themes, one engine"; a list of six theme names
   (Violet … Monochrome); a sentence that the swatches come from the theme
   engine; links "Browse the theme gallery", "Browse the component catalog".
3. Region "Why Svelte for the web": three claims, each a paragraph that opens
   with a strong lead ("Compiled, not carried.") followed by its link; the
   ladder is a list of 3 items, each with a figure whose name is the caption
   plus the file path, then the code region, then a link.
4. Region "One line in, two languages out": a list of 3 steps (Authored once,
   TypeScript projection, Kotlin projection); each figure is named by its file
   path, and the shared summary string is a `mark` inside the code. The native
   status is plain text: "Native renderer: in development…".
5. Region "Built for agents, too": the steps list, the five agent surfaces
   (link, then a one-line description), then the closing band: heading level 3
   "One platform, two runtimes. Start today.", region "Install command"
   (`pnpm add texuli@next`), button "Copy install command", an empty status
   (the copy confirmation is announced through it), the preview note, links
   "Open the playground", "Start building", "See the native story".

### Tab order

Skip link → banner (8 stops) → hero CTAs and the three number links → theme
links → each claim link and code region in reading order → agent surfaces →
install region → "Copy install command" → closing links → footer links →
back to the skip link. No stop is skipped or out of visual order.

### Findings

None blocking. Two links repeat a destination with the same name ("Read the
why-Svelte guide" twice, "Start building" three times); the names stay true to
their targets, so they are not ambiguous. The closing band is a level-3
heading inside "Built for agents, too": the band is part of that section's
markup, so its heading entry sits under that section.

## 2. Native landing (`/native/`)

**Title:** "Texuli native — the same catalog, rendered by Compose · Texuli".

### Heading outline

- h1 "The same catalog, rendered by Compose."
  - h2 "What exists today"
  - h2 "Why Kotlin Multiplatform" — h3 "Why Kotlin wins the native half", "How the renderer consumes the contract"
  - h2 "What exists in this repository today" — h3 "The native modules", "Shipped, in this repository", "Planned"

### Landmarks

banner · main with regions "The same catalog, rendered by Compose." (holding
region "What exists today"), "Why Kotlin Multiplatform", "What exists in this
repository today", and two Kotlin code regions · contentinfo.

### Reading order

1. Eyebrow "Texuli native · in development"; heading level 1; the lead; links
   "Read the deep dive: why Svelte and Kotlin", "Why web and native, one
   contract".
2. Region "What exists today": a description list of four rows. Each row is a
   term ("Web runtime", "Spec contract", "Native renderer", "Maven Central")
   and a definition that starts with its status, then the detail:
   "Shipped : All 15 packages are published to npm as 0.1.0-next.1…",
   "In development : A Compose renderer…", "Planned (ADR-005) :
   Publication under the fixed com.texuli coordinates…". The colon is visually
   hidden; the snapshot puts a space on each side of it because the badge and
   the detail are separate flex items.
3. Region "Why Kotlin Multiplatform": a list of four claims (strong lead, then
   text); the pipeline list where `loadBlueprint` and `BlueprintView` are code;
   two figures named "The renderer's entry point, quoted verbatim: …" and "The
   honest coverage registry, quoted verbatim: …", each with its code region;
   the status paragraph; two links.
4. Region "What exists in this repository today": a description list of six
   modules (term, then a definition with a paragraph and the path as code);
   list "Shipped, in this repository", 7 items; heading "Planned" with its
   note and a list of 5 items; a list of two links.

### Findings

- **Fixed (T-90):** the status badge ran straight into its detail. The tree
  exposed "Shipped All 15 packages are published…" and "Planned (ADR-005)
  Publication under…" as one run, so the status read as the first word of the
  sentence. A visually hidden colon now separates them
  (`apps/website/src/components/sections/native/NativeHeroStatus.astro`,
  pinned by `apps/website/tests/a11y-sr-pass.test.ts`). The visual design is
  unchanged.

## 3. Architecture page (`/web-and-native/`)

**Title:** "Web and native, one contract — Texuli's architecture · Texuli".

### Heading outline

- h1 "Web and native, one contract — Texuli's architecture"
  - h2 "Why both technologies"
  - h2 "The layer graph: nine floors, dependencies point down"
  - h2 "The texel ladder: three rungs, two runtimes" — h3 "texels", "primitives", "components"
  - h2 "One contract, two projections"
  - h2 "One line in, two languages out" — h3 "What moves today", "Planned"
  - h2 "Interface portability: the mechanism" — h3 "One declaration, two projections", "Define once", "Project twice", "Tokens cross", "Semantic roles cross", "What does not move today"
  - h2 "What exists today"
  - h2 "The same catalog, capability by capability"

### Landmarks (after the fix)

banner · navigation "Primary" (site sidebar, "Web + native" is the current
page) · main, holding navigation "Breadcrumb" (Home, Web + native), the
"Copy page" button and its status, the article, and navigation "Previous and
next pages" ("Previous Skill", "Next Native (Kotlin)") · navigation "On this
page" · contentinfo.

### Reading order

1. Breadcrumb; "This page ships a Markdown twin for AI tools."; button "Copy
   page".
2. Article: eyebrow "Documentation", heading level 1, the lead.
3. "Why both technologies": a list of two (Svelte 5 for the web; Kotlin
   Multiplatform and Compose for native), the non-goal paragraph, and the links
   "Why Svelte and Kotlin" and "Texuli native".
4. Region "The layer graph…": the layer table is a figure whose caption says
   the diagram repeats the table; the table itself is captioned "The layer
   graph as a table: every workspace package, the floor it sits on, what it
   holds, and the lower floors it may depend on.", with column headers Layer,
   Package, What it holds, Depends on, and one row per package.
5. Region "The texel ladder…": a list of three rungs, each a heading level 3,
   a summary, the package and layer, and a Web / Native description list.
6. "One contract, two projections", then the correlation demo region (the same
   section as on the landing), then region "Interface portability: the
   mechanism" with three named source regions.
7. "What exists today" and region "The same catalog, capability by
   capability": table "Web and native status per capability…" with column
   headers Capability, Web runtime, Native runtime, Evidence; each row starts
   with a row header, and each status cell reads the status ("Exists",
   "In this repository", "Planned") before its detail paragraph.
8. Pager, then the "On this page" navigation, then the footer.

### Findings

- **Fixed (T-90):** the page rendered the docs-shell demo navigation. A second
  navigation named "Documentation" (Start, Shell, Slides, Editor: links to
  `/docs-shell/`, `/slides-page/`, `/editor-page/` and examples) sat between
  the copy button and the article on desktop, and a "Documentation menu"
  disclosure with the same links appeared on phones. Neither contained this
  page, so a landmark list showed "Primary" and "Documentation" side by side
  with no current page in the second. `DocsShell` now takes `demoNav`
  (default on, kept by the three `/docs-shell/` pages), and
  `/web-and-native/` passes `demoNav={false}`; the article takes the freed
  column. Files: `apps/website/src/components/docs-shell/DocsShell.astro`,
  `apps/website/src/pages/web-and-native/index.astro`; test:
  `apps/website/tests/a11y-sr-pass.test.ts`.
- **Fixed (T-90):** the build's HTML compression dropped the space before the
  guide link, so the text run (and the page's Markdown twin) read "lives in
  the guideWhy Svelte and Kotlin". The space now sits on the same source line
  (`apps/website/src/pages/web-and-native/index.astro`, same test file).
- Observation, not fixed: "One line in, two languages out" is a level-2
  heading right after the level-2 "One contract, two projections" that
  introduces it ("The demo below walks one component through that seam").
  The outline skips no level, so this is not a failure; nesting it would need
  a heading-level prop on the shared `WebCorrelation` section.

## 4. Guide (`/guides/accessibility/`)

**Title:** "Accessibility · Texuli".

### Heading outline

- h1 "Accessibility" — h2 "The bar", "Labels and names", "Keyboard", "Live controls"

### Reading order

1. Breadcrumb, "Copy page", then the article: eyebrow "Guides", heading level
   1, the lead.
2. "The bar" and "Labels and names": prose with inline code
   (`CanvasText`, `aria-label`, `Field`, …); region "Field with Input" holds
   the code sample.
3. "Keyboard": prose.
4. "Live controls": text field "Workspace name", value "Harbor design", with
   the description "Announced with the control via aria-describedby." (its
   `aria-describedby` resolves to that paragraph); switch "Email digest",
   checked; buttons "Save settings", "Cancel"; the hint paragraph.
5. Pager "Previous Dark mode" / "Next RTL and i18n"; navigation "On this page"
   with four in-page links.

### Findings

None. Every control in the live demo has a name that matches its visible
label, the switch exposes its checked state, and the description is wired.

## 5. Studios

### Theme studio (`/theme-studio/`)

**Outline:** h1 "Theme studio" — h2 "Start from" (h3 "Preset seeds",
"Library themes"), "Source", "Tune roles", "AA check", "Live components" (h3
"Harbor Notes preview"), "Export".

**Reading order:** region "Start from": group "Preset seeds" (8 buttons named
with the seed and its hex, "Harbor blue #2b6ce0" …) and group "Library themes"
(8 buttons, "Enterprise Neutral enterprise" …) · region "Source": group "Theme
source" (toggle buttons Color, pressed; Words; Image), text field "Brand color"
value `#2b6ce0`, text field "Secondary color" (named "Secondary color
(optional)" since T-88), select "Neutral family"
(zinc selected), group "Contrast target" (AA 4.5:1 pressed, AAA 7:1), button
"Generate theme" · region "Tune roles": select "Role to tune", text field
"Role color" (named "Color for light mode", or "… dark mode", since T-88)
value `#2869dd`, button "Apply role" · region "AA check": status
"Default seed loaded. All gated pairs meet WCAG AA (4.5:1 text)." and the
failing-pairs count · the collapsed "Keyboard" disclosure · region "Live
components": group "Preview mode", sample buttons, badges, the preview card,
link "Sample link", text field "Sample field" · region "Export": group "Export
format", region "Output" (the whole theme CSS), buttons "Copy CSS", "Copy
share link".

**Findings (recorded in this pass; fixed by T-88):**

- Label in name (WCAG 2.5.3): the visible label "Color for light mode" (or
  "… dark mode") named its field "Role color"; a speech-input user saying the
  visible label did not reach it. The visible "Secondary (optional)" field was
  named "Secondary color", which dropped "(optional)". **Fixed by T-88:**
  each field's `aria-label` now matches its visible label ("Color for light
  mode", "Secondary color (optional)"), pinned by
  `apps/website/tests/theme-studio-label-in-name.test.ts`. The tree was not
  re-captured after the fix.

### Agent playground (`/playground/`)

**Outline:** h1 "Agent playground" — h2 "Presets, and what each one proves",
"Sink-free preview", "Validation".

**Reading order:** region "Presets…": group "Presets", 36 toggle buttons, the
first pressed; at capture time each name was the group tag, the title and the
caption concatenated ("safe Card with title The baseline: a clean tree renders
whole."; since T-88 the name is the title and the tag and caption are its
description) · select "Preset" · text field "Catalog tree JSON" (the card JSON) ·
buttons "Render tree", "Reset preset" · the "Keyboard" disclosure · region
"Sink-free preview": at capture time, status "Nothing to show. The tree was
empty or every node was dropped." · region "Validation": status "Run Render
tree to see diagnostics.". Since T-88 the pressed preset runs on load, so the
preview shows its tree and Validation reads "No diagnostics." at once. After
"Render tree", the preview is a list with the card's
props as a description list, and the Validation status reads "No diagnostics.
The tree is clean under the untrusted tier."

**Findings (recorded in this pass; all three fixed by T-88, pinned by
`apps/website/tests/playground-sr.test.ts`; the tree was not re-captured
after the fix):**

- Value: on load the first preset was pressed and its JSON was in the editor,
  but the preview status said "Nothing to show. The tree was empty or every
  node was dropped." — false for a clean card that simply had not run yet.
  **Fixed:** the pressed preset runs on load; after "Reset preset" the status
  says "Not rendered yet. …".
- Name: each preset button's name was tag + title + caption (up to about 200
  characters). **Fixed:** the button is named by its title; the tag and the
  caption are its `aria-describedby` description.
- Live region: when a hostile preset produced diagnostics, the Validation
  status element was replaced by a list, so the change was outside any live
  region. **Fixed:** one persistent status element stays in place and states
  the diagnostics count ("N diagnostics under the untrusted tier, listed
  below.").

## Not covered

- A live VoiceOver, NVDA or JAWS session: no screen reader was run. Nothing
  here records speech.
- WebKit/Safari and Firefox trees; mobile trees beyond the phone-width check
  of the architecture page's navigation.
- Dark mode, forced colors and RTL trees (axe covers dark mode in
  `tests/e2e/a11y-site.spec.ts`).
- Interactive flows past the first state, except the playground's "Render
  tree" and one hostile preset.
