# Artifact frame

**Package:** `@texuli/catalog`  
**Import:** `@texuli/catalog/render/frame`  
**Tests:** `packages/catalog/tests/render-frame.test.ts`

## Goal

A **host-owned, visibly labelled frame** around untrusted catalog output.
Actions never run inside the frame — they leave as **intents** the host
confirms.

| Rule | Behavior |
| --- | --- |
| Visible label | Required plain text; empty or HTML-like → frame fails (no roots) |
| Badge | Always present (default `Untrusted content`) |
| Chrome | `requiresVisibleChrome: true` — host UI must show label + badge |
| Tier | Defaults to **untrusted**; developer tier needs `allowDeveloperTier` |
| Actions | `proposeIntent` → `confirmIntent` / `rejectIntent` (host applies effects) |
| Payload | Plain scalars/objects only; no `class`/`style`, no HTML strings, no functions |
| URLs | `href` / `src` / `url` / `poster` pass `safeHref` / `safeMediaSrc` (`untrusted`); failures are `unsafe-url` and never reach `pendingIntents` or the summary. Over-long URL fields are **refused** (never truncated). |
| Summary / plain text | Bidi/control stripped; summary max 200 characters; plain payload strings max 2048 (truncation only for non-URL text) |

## Usage

```ts
import { renderCatalogFromSpecs } from '@texuli/catalog/render/renderer';
import {
  artifactChrome,
  confirmIntent,
  createArtifactFrame,
  proposeIntent,
} from '@texuli/catalog/render/frame';

const catalog = renderCatalogFromSpecs([/* … */]);
const frame = createArtifactFrame({
  label: 'Assistant reply',
  source: 'session-demo',
  catalog,
  tree: { id: 'card', props: { variant: 'elevated', title: 'Hello' } },
});

const chrome = artifactChrome(frame);
// chrome.ok && chrome.label && chrome.badge → paint host chrome

const proposed = proposeIntent(frame, {
  kind: 'navigate',
  path: '0',
  componentId: 'card',
  payload: { href: 'https://example.com/docs' },
});
if (proposed.ok) {
  // Show confirm UI with proposed.intent.summary
  const settled = confirmIntent(proposed.frame, proposed.intent.id);
  if (settled.ok) {
    // Host alone performs navigation using settled.intent.payload
  }
}
```

## Security

- No HTML sinks, no style/class passthrough (inner tree uses the sink-free renderer).
- Intents are data only; the frame never calls `location`, `fetch`, or host APIs.
- URL policy on `href`/`src` remains the host’s job when applying a confirmed intent.
