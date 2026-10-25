# texuli.com: media lab

**App:** `apps/website`  
**Route:** `/media-page/`  
**Components:** `src/components/media-page/`  
**Tests:** `tests/e2e/site-media-page.spec.ts` · `scripts/tests/site-media-page.test.ts`

## Goal

**Image**, **video**, **audio** and **composition** demos, including **exporting
a composition to PNG and WebM in the browser**. Static output, no runtime
network to other origins, axe clean in light and dark on desktop and Pixel 7.

## How it works

| Section | What |
| --- | --- |
| Image | `@texuli/media/image` with same-origin `/media-lab/harbor.svg` + blocked `javascript:` |
| Video | `@texuli/media/video` with inline WebVTT captions/chapters; remote src refused by URL policy; local poster |
| Audio | Synthetic peaks + blob WAV created on mount; blocked `javascript:` control |
| Composition | Canvas middle-frame preview + `CompositionExport` (PNG/SVG/WebM) from shape/text data |
| Unsafe export | Composition with `javascript:` image layer — exports refuse instead of downloading |

Assets live under `apps/website/public/media-lab/` (copied fictional harbor SVG).
Export uses `@texuli/media/export/ui` and never uploads.

## Usage

```bash
pnpm build
pnpm --filter @texuli/website preview
# open /media-page/
```

## Tests

```bash
pnpm vitest run scripts/tests/site-media-page.test.ts
bash -c 'pnpm build && TEXULI_E2E_PORT=4910 pnpm exec playwright test tests/e2e/site-media-page.spec.ts'
```

The e2e spec serves `apps/website/dist` on a free loopback port and checks
Chromium, WebKit and Pixel 7:

- sections for image, video, audio, composition;
- export group present (PNG / SVG / WebM when supported);
- PNG export produces a downloadable blob (chromium);
- no foreign network;
- axe WCAG 2.1 A/AA in light and dark.

## Limits

- The video **source** is intentionally blocked so the static lab never pulls
  remote media; chrome, captions UI and policy fallbacks are what the page
  demonstrates. Live remote video needs a policy-safe blob or HTTPS origin the
  host allowlists.
- WebM export needs a browser `MediaRecorder` that can encode WebM; where it
  cannot, the control disables the button (documented by the export package).
- Primary nav may not link here yet (foundation `NAV`).
- APCA is out of scope; WCAG 2.x only for page chrome.
