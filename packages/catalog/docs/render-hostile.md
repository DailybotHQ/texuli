# Hostile corpus

**Package:** `@texuli/catalog`  
**Import:** `@texuli/catalog/render/hostile`  
**Tests:** `packages/catalog/tests/render-hostile.test.ts`, `packages/catalog/tests/hostile-pipeline.test.ts`, `packages/catalog/tests/hostile-fuzz.test.ts`, `tests/e2e/renderer-hostile.spec.ts`  
**Fixtures:** `tests/fixtures/hostile/corpus.json`

## Goal

A fixed set of **hostile** catalog trees and richtext strings that must always
render **inert** through the sink-free pipeline:

| Category | Examples |
| --- | --- |
| Script URLs | `javascript:`, `vbscript:`, `data:text/html` |
| Fake dialogs | Non-emittable `dialog` / `alert-dialog` under untrusted |
| Bidi tricks | RLO/LRO, zero-width, isolates in labels and titles |
| Giant trees | Depth and breadth beyond tree limits |
| Prompt injection | Instruction-like copy and script links in richtext |
| HTML strings | `<script>`, `<img onerror>` in string props |
| Style/class | `class` / `style` / `className` passthrough |
| Unknown ids | Components not in the catalog |
| Deep nesting | Props and block objects nested past the structure limit; children one level past the depth limit |
| Unicode | Right-to-left overrides in text, isolates, zero-width and BOM, zero-width and fullwidth `javascript:`, a bidi override in a link host |
| Prototype shapes | Own `__proto__` and `constructor.prototype` keys from raw JSON, in props, blocks and on nodes |
| Oversized | Long strings and keys past the byte limit, hundreds of unknown props |
| Duplicate keys | Raw JSON where the last `href` or `id` wins (a script link, a chrome id) |
| URL tricks | Tab- and newline-split schemes, mixed case, protocol-relative, a developer-only relative link, credentials before the host, an SVG data image, a script URL deep in chart data |

A sample is a `tree`, a `richtext` string, or raw JSON `text` for shapes a JS
object cannot hold (own `__proto__` keys, duplicate keys).

## Pipeline

1. `renderCatalogTreeWithLimits` — rejects giant trees  
2. `renderCatalogTree` / artifact frame — placeholders, prop sanitize, scrub  
3. `renderRichText` — link URLs through `safeHref('untrusted')`  
4. `assertInertRoots` — no executable strings, no class/style  

## Usage

```ts
import { runHostileCorpus } from '@texuli/catalog/render/hostile';
import { renderCatalogFromSpecs } from '@texuli/catalog/render/renderer';

const report = runHostileCorpus({ catalog: renderCatalogFromSpecs(specs) });
if (!report.ok) throw new Error('corpus not inert');
```

## Invalid or inert, end to end

`hostile-pipeline.test.ts` runs every sample, bare and wrapped in a frame,
through `validateDraft` and the document player core. `validateDraft` never
throws, and a valid draft carries nothing executable. Under both the default
`refuse` policy and `preview`, the player paints no forbidden or handler key,
no prototype key in a valid draft, and no URL the untrusted policy refuses.

`hostile-fuzz.test.ts` repeats that check for three fixed seeds × 180 rounds
of generated hostile trees and raw-JSON mutations (duplicate keys, injected
`__proto__`, truncated text). It uses no network and takes a few seconds; the
same seed always gives the same inputs.

The fuzz rounds found that a preview of an invalid draft could pass handler
keys nested in block data through to a component. The player now drops
forbidden, handler and prototype keys at any depth at paint, and drops values
nested too deep to police.

## Regenerating the fixture

```bash
pnpm exec tsx packages/catalog/scripts/write-hostile-corpus.ts
```

It writes bidi and zero-width controls as JSON escapes; the repository's
Trojan Source gate allows no literal controls in tracked files. A test fails
when `corpus.json` drifts from `HOSTILE_SAMPLES`.

## Browser

`tests/e2e/renderer-hostile.spec.ts` paints escaped inert HTML only (no agent
HTML sinks) and asserts zero script execution plus axe clean.
