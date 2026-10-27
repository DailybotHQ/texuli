# Texuli packages and layers

Every workspace package, its layer and its public entries. Layers point down
only: a package imports only from lower layers (the repository's
`scripts/check-layers.ts` enforces it). **All 15 packages are on npm as
`0.1.0-next.1` under the `next` dist-tag** (published by CI with provenance;
no stable release, `latest` is reserved for 1.0.0; the workspace packages
stay `private: true`), so install them with `@next`, import them in a Texuli
workspace, or copy components with the CLI
([`../components/SKILL.md`](../components/SKILL.md)).

This table is derived from each `packages/*/package.json` `exports` map and the
`LAYERS` map in `scripts/check-layers.ts`. Long entry lists are cut after 14;
read the package's `package.json` for the rest.

| Layer | Package | What it is | Public entries |
| --- | --- | --- | --- |
| L0 | `@texuli/core` | Texels: framework-free behavior and policy that every Texuli component is built from. | `@texuli/core`, `@texuli/core/announcer`, `@texuli/core/controllable`, `@texuli/core/dir-locale`, `@texuli/core/dismiss`, `@texuli/core/env`, `@texuli/core/focus-scope`, `@texuli/core/form-bridge`, `@texuli/core/ids`, `@texuli/core/inert`, `@texuli/core/keyboard`, `@texuli/core/layer-stack`, `@texuli/core/lazy`, `@texuli/core/overlay`, … (23 entries) |
| L0 | `@texuli/spec` | The schema-first blueprint contract: JSON schemas, the catalog vocabulary, deterministic TypeScript and Kotlin projections, and the conformance harness. | `@texuli/spec`, `@texuli/spec/codegen` |
| L1 | `@texuli/primitives` | Owned, headless Svelte 5 primitives built on the texels. | `@texuli/primitives`, `@texuli/primitives/accordion`, `@texuli/primitives/alert-dialog`, `@texuli/primitives/avatar`, `@texuli/primitives/calendar`, `@texuli/primitives/checkbox`, `@texuli/primitives/collapsible`, `@texuli/primitives/color-picker`, `@texuli/primitives/combobox`, `@texuli/primitives/command`, `@texuli/primitives/context-menu`, `@texuli/primitives/date-field`, `@texuli/primitives/date-picker`, `@texuli/primitives/dialog`, … (42 entries) |
| L2 | `@texuli/tokens` | The OKLCH theme engine, the --tx-* token contract, 200+ themes and compiled CSS. | `@texuli/tokens`, `@texuli/tokens/aa-gate`, `@texuli/tokens/aa-gate/components`, `@texuli/tokens/base.css`, `@texuli/tokens/build`, `@texuli/tokens/contract`, `@texuli/tokens/css`, `@texuli/tokens/forced-colors`, `@texuli/tokens/forced-colors.css`, `@texuli/tokens/generator`, `@texuli/tokens/library`, `@texuli/tokens/library-expand`, `@texuli/tokens/modes`, `@texuli/tokens/no-flash`, … (18 entries) |
| L3 | `texuli` | Styled Texuli components, layouts and shells. | `texuli`, `texuli/alert`, `texuli/avatar`, `texuli/badge`, `texuli/button`, `texuli/card`, `texuli/carousel`, `texuli/choice`, `texuli/combobox`, `texuli/command`, `texuli/cx`, `texuli/date`, `texuli/dialog`, `texuli/empty`, … (70 entries) |
| L4 | `@texuli/charts` | Chart math and every chart family, one lazy subpath per family. | `@texuli/charts`, `@texuli/charts/annotations`, `@texuli/charts/calendar`, `@texuli/charts/canvas`, `@texuli/charts/cartesian`, `@texuli/charts/compact`, `@texuli/charts/flow`, `@texuli/charts/geo`, `@texuli/charts/histogram`, `@texuli/charts/interaction`, `@texuli/charts/math`, `@texuli/charts/matrix`, `@texuli/charts/pack`, `@texuli/charts/part-whole`, … (15 entries) |
| L4 | `@texuli/chat` | Chat interfaces: thread, message list, composer and typing indicator, generic for people and agents. | `@texuli/chat` |
| L4 | `@texuli/data` | Data views: grid, tree, board, calendar, timeline, map, activity and files. | `@texuli/data`, `@texuli/data/activity`, `@texuli/data/activity/engine`, `@texuli/data/board`, `@texuli/data/board/engine`, `@texuli/data/calendar`, `@texuli/data/calendar/view`, `@texuli/data/files`, `@texuli/data/files/engine`, `@texuli/data/geo`, `@texuli/data/grid`, `@texuli/data/grid-columns`, `@texuli/data/grid-core`, `@texuli/data/grid-editing`, … (21 entries) |
| L4 | `@texuli/media` | Media: images, galleries, video, audio and layered compositions. | `@texuli/media`, `@texuli/media/animation`, `@texuli/media/animation/player`, `@texuli/media/audio`, `@texuli/media/captions`, `@texuli/media/composition-canvas`, `@texuli/media/composition-canvas/draw`, `@texuli/media/composition-canvas/render`, `@texuli/media/composition-model`, `@texuli/media/composition-svg`, `@texuli/media/export`, `@texuli/media/export/ui`, `@texuli/media/gallery`, `@texuli/media/gallery/lightbox`, … (20 entries) |
| L5 | `@texuli/blocks` | Content blocks: closed vocabulary, untrusted guard, formula AST and catalog metadata for pages, documents and slides. | `@texuli/blocks`, `@texuli/blocks/code`, `@texuli/blocks/code/engine`, `@texuli/blocks/code/renderers`, `@texuli/blocks/code/tokenizer`, `@texuli/blocks/core`, `@texuli/blocks/data`, `@texuli/blocks/data/engine`, `@texuli/blocks/data/renderers`, `@texuli/blocks/diagram`, `@texuli/blocks/diagram/engine`, `@texuli/blocks/diagram/renderers`, `@texuli/blocks/embed`, `@texuli/blocks/embed/engine`, … (32 entries) |
| L6 | `@texuli/catalog` | The agent catalog and the renderer with no HTML sinks. | `@texuli/catalog`, `@texuli/catalog/build`, `@texuli/catalog/build/node`, `@texuli/catalog/edit`, `@texuli/catalog/envelope`, `@texuli/catalog/manifest`, `@texuli/catalog/manifests/content`, `@texuli/catalog/manifests/display`, `@texuli/catalog/manifests/forms`, `@texuli/catalog/manifests/layouts`, `@texuli/catalog/manifests/overlays`, `@texuli/catalog/player`, `@texuli/catalog/render/frame`, `@texuli/catalog/render/grammar`, … (19 entries) |
| L7 | `@texuli/player` | Svelte paint runtime for validated Texuli catalog blueprints. | `@texuli/player`, `@texuli/player/styles.css` |
| L7 | `@texuli/slides` | Presentation deck model, grammar, and responsive stage runtime. | `@texuli/slides`, `@texuli/slides/model`, `@texuli/slides/grammar`, `@texuli/slides/stage`, `@texuli/slides/styles.css` |
| L8 | `@texuli/astro` | Astro integration, content layouts and Svelte islands for Texuli sites. | `@texuli/astro`, `@texuli/astro/content`, `@texuli/astro/integration`, `@texuli/astro/styles.css`, `@texuli/astro/layouts/ContentLayout`, `@texuli/astro/sections/Hero`, `@texuli/astro/sections/Section` |
| L8 | `@texuli/tools` | Agent and developer tools: the copy-in CLI, the MCP server, custom elements, adapters and the golden set. | `@texuli/tools`, `@texuli/tools/a2ui`, `@texuli/tools/cli-add`, `@texuli/tools/cli-init`, `@texuli/tools/cli-update`, `@texuli/tools/llms`, `@texuli/tools/elements`, `@texuli/tools/golden` |

Apps that consume the packages (not layers):
- `apps/website`: texuli.com, built with Astro 7 and Svelte islands. It
  deploys from `main` to Cloudflare Pages. It hosts the playground, the
  blueprint builder (`/builder/`) and the agent chat (`/agent-chat/`).
- `apps/agent` (`@texuli/agent`): the agent service. It is not deployed and
  has no real model provider (see [`../blueprints/SKILL.md`](../blueprints/SKILL.md)).

`native/` is a self-contained Gradle build for the native target, outside the
pnpm workspace. Its Kotlin has not been compiled yet (`native/README.md`).

## Entries checked by the skill gate

`pnpm check:skill` checks every import in this block against the real
`exports`, so the index cannot point at an entry that does not exist.

```ts
import { validateBlueprint } from '@texuli/spec';
import { buildSpec } from '@texuli/spec/codegen';
import { createRovingFocus } from '@texuli/core/roving';
import { safeHref, safeImageSrc, safeMediaSrc } from '@texuli/core/url-policy';
import { Button } from 'texuli/button';
import { cx, variants } from 'texuli/cx';
import { ChatThread, parseMessageText } from '@texuli/chat';
import { GenerationRequestPlaceholder, parseMediaGenerationRequest } from '@texuli/media/generator-slot';
import { safeParseBlock } from '@texuli/blocks/core';
import { validateDraft, draftCommitGate } from '@texuli/catalog/validate';
import { createEnvelope, activateEnvelope } from '@texuli/catalog/envelope';
import { createEditHistory } from '@texuli/catalog/edit';
import { createPlayer } from '@texuli/catalog/player';
import { renderCatalogFromBuild } from '@texuli/catalog/render/renderer';
import { Player } from '@texuli/player';
import '@texuli/player/styles.css';
import { parseDeck } from '@texuli/slides/model';
import { toDeckGrammar } from '@texuli/slides/grammar';
import { DeckStage } from '@texuli/slides/stage';
import { texuli } from '@texuli/astro';
import { GOLDEN_TASKS, scoreGoldenTree } from '@texuli/tools/golden';
```
