# texuli.com: slides area

**App:** `apps/website`  
**Route:** `/slides-page/`  
**Components:** `src/components/slides-page/` (content data), `src/components/examples/ExampleHost.svelte` (the islands)  
**Tests:** `tests/e2e/site-slides.spec.ts` · `scripts/tests/site-loaders.test.ts`

## Goal

Make `@texuli/slides` a first-class area of the site: a live deck to try, the
starter templates, the other slides examples, what ships and what is
planned, and where the package docs live. Static output, no runtime network
to other origins, axe clean in light and dark.

## How it works

| Section | What |
| --- | --- |
| Try the deck | The `slides-tour` example mounted eagerly in an `ExampleHost` island: a `DeckStage` with reveal steps, slot masters, code highlights, speaker notes, the overview and fullscreen, and a keyboard hint list |
| Starter templates | The three `slides-template-*` examples as non-interactive previews (`ExampleHost` in listing mode, mounted when scrolled into view), each linking to its `/examples/<id>/` page |
| More examples | Links to `slides-fragments`, `slides-presenter-screen`, `slides-slot-masters` and `slides-media-deck`, plus the slide deck showcase screen, labeled as a mock-up built from Texuli components rather than `@texuli/slides` |
| What ships / Planned | The capabilities that exist today, then the planned ones (a presenter screen on another device, a next-slide thumbnail and wall clock, a tool-side PDF exporter, deck video) |
| Package docs | The `packages/slides/` docs by repository path, as text: the site does not render package docs |

The decks come from the examples registry (`@texuli/examples`), which already
depends on `@texuli/slides`. The website does not depend on
`@texuli/slides` directly; adding it would change the website manifest and
the lockfile, which the owner holds. The deck themes use `system` mode, so
they follow the site's light or dark mode, and the stage cuts slide and
reveal motion under reduced motion.

## Navigation

- **Site sidebar:** `Slides` in the Components group (`NAV_GROUPS` in
  `src/components/foundation/site.ts`), after Examples.
- **Docs shell:** a `Slides` section in `src/components/docs-shell/nav.ts`
  (overview, package docs anchor, the tour example and the showcase screen).
  It extends the docs shell's previous and next order, so the navigation
  page's next link is the slides overview.
- **Showcase:** `/showcase/slide-deck/` links to the area, and the area links
  back.

## Tests

```bash
pnpm build
TEXULI_E2E_PORT=4872 pnpm exec playwright test tests/e2e/site-slides.spec.ts --project=chromium
pnpm vitest run scripts/tests/site-loaders.test.ts
```

The e2e spec serves `apps/website/dist` on a loopback port and checks:

- the h1, the section headings and no foreign network;
- the stage: Next slide, then Next step reveals a list item, Right and Left
  reveal and hide from the keyboard, and the presenter view shows the step
  progress;
- fullscreen opens natively or fills the window, and Exit fullscreen returns
  focus;
- every template, example, docs-shell and showcase link resolves to a built
  page with the expected h1;
- axe WCAG 2.1 A/AA in light and dark, with every preview loaded.

## Limits

- The site has no slides component pages; the package docs stay in the
  repository.
- The template previews are inert; present a template from its example page.
- The presenter screen across two windows is not demonstrated on the page:
  it needs a second window the host opens.
