# Embedding the blueprint flow

**Packages:** `@texuli/player`, `@texuli/catalog` (on npm as `0.8.0`, a
pre-1.0 release; no stable 1.0.0 yet; the workspace packages stay
`"private": true`)

How a host app takes a blueprint from an agent or a person, validates it,
lets someone edit it with undo, digests it and paints it. This is the flow
the texuli.com builder runs
([site-builder.md](../../../apps/website/docs/site-builder.md)). The builder
is website code; everything below uses only the packages' public exports.

[embedding.md](embedding.md) covers mounting the player itself: its props,
the trust badge, labels and the four ways to embed. This guide covers the
steps around it.

```text
blueprint (text or data)
  → validateDraft            @texuli/catalog/validate   (optional: the player re-validates anyway)
  → createEditHistory        @texuli/catalog/edit        (edit ops, undo, redo, commit gate)
  → <Player blueprint>       @texuli/player              (validate again, paint, report)
  → blueprintDigest          @texuli/catalog/edit        (what the owner reviewed)
  → activateEnvelope         @texuli/catalog/envelope    (your own activate control)
```

## 1. Mount the player

```svelte
<script lang="ts">
  import { Player, PLAYER_LOADERS } from '@texuli/player';
  import '@texuli/player/styles.css';

  let { tree } = $props();
</script>

<Player
  blueprint={tree}
  label="Untrusted draft preview"
  status="draft"
  invalidPolicy="preview"
  loaders={PLAYER_LOADERS}
  landmarks={false}
  onDiagnostics={(event) => console.log(event.status, event.diagnostics)}
  onNodeError={(error) => console.log(error.code, error.path)}
/>
```

- **Every change re-validates.** Pass the new tree through `blueprint` and
  the player re-validates the whole tree on the same handle. Loaded painters,
  local state, the flow view and the selection are kept
  ([Live updates](reference.md#live-updates-r20)).
- **Invalid drafts.** `invalidPolicy="refuse"` (the default) shows a notice
  instead of the tree. `"preview"` paints the valid parts with visible
  placeholders under a warning, for an editor; it never activates anything.
- **Inline in your page.** Pass `landmarks={false}` when the player sits
  inside your own `main`, so the page layout does not paint a second one.
- **Reports.** `onDiagnostics` receives
  `{ status, surface, error?, diagnostics, receipt, stateIssues }` after each
  validation, and `onNodeError` receives `{ code, id, path, phase, error? }`
  once per node that cannot paint. Diagnostic messages are text; render them
  as text.
- **Without Svelte.** `mountPlayer(target, props)` mounts the same component
  and returns `update`, `setState`, `getState`, `dispatchFlow`, `getView` and
  `dispose` ([embedding.md](embedding.md#2-es-module-without-svelte)).

## 2. Tiers: who wrote it decides

The tier is always the host's choice, never the blueprint's. An envelope's
declared `tier` only produces a `tier-ignored` warning.

| Source | Tier | What it means |
| --- | --- | --- |
| A blueprint from an agent, a user or any stored draft | `untrusted` (the default for `<Player>`, `validateDraft` and `createPlayer`) | Only agent-emittable ids. The chrome shows the **Untrusted content** badge |
| A tree a person authored in a trusted tool you control | `developer` (`tier="developer"`) | Also allows developer-only ids, and shows no badge |
| Props you write in your own code, outside any blueprint | Not a blueprint: use the component directly | For example, `trust="developer"` on an image component lets your own markup use a data or HTTP image |

Two rules do not move with the tier:

- **Paint-time URL policy.** The player core re-applies the **untrusted** URL
  policy to every link and media prop at paint, whatever tier validated the
  tree ([paint-proof.md](paint-proof.md)).
- **Pinned trust.** `trust` on `media-image` and the two media compositions
  (`TRUST_PINNED_IDS`) is always painted as `untrusted`. A blueprint's
  `trust: "developer"` cannot widen their image policy (`applyMediaPolicy`).
  Only your own code, outside the blueprint, can pass `trust="developer"`.

`HOST_CHROME_IDS` (today `chat-composer`) are denied at every tier; pass your
composer as the `composer` snippet instead.

## 3. Loaders

`PLAYER_LOADERS` maps each catalog id the player can paint to a dynamic
import, so a blueprint loads only the families it uses. Ids without a loader
paint a `no-loader` placeholder.

```ts
import { CHAT_DISPLAY_LOADERS } from '@texuli/chat';
import { PLAYER_LOADERS } from '@texuli/player';

// @texuli/player does not depend on @texuli/chat; add its display painters yourself.
const loaders = { ...PLAYER_LOADERS, ...CHAT_DISPLAY_LOADERS };
```

- **Time limit.** `loadTimeoutMs` (default `DEFAULT_LOAD_TIMEOUT_MS`,
  15 000 ms; `0` turns it off) turns a load that never settles into a
  `node-error` placeholder. The builder uses 8 000 ms. `withLoadTimeout`
  is the same wrapper for a loader map you use elsewhere.
- **Host chrome stays out.** The player drops loaders for host chrome ids
  itself (`withoutHostChromeLoaders`), even when your map has them.
- **Failures are contained.** A failed load is not retried while the player
  is mounted (retrying is planned); siblings and the parent still paint.

## 4. Validate before you store

The player validates on every paint, so you only need `validateDraft` when
you act on a draft without painting it: storing it, accepting an import, or
gating an edit. To get the same verdict the player reaches, pass the same
options it passes to its core:

```ts
import { formulaConditions } from '@texuli/catalog/render/conditions';
import { validateDraft } from '@texuli/catalog/validate';
import { createFamilyBlockCheck, diagramFamilyCheck } from '@texuli/catalog/validate/blocks';
import { checkCodeBlock } from '@texuli/blocks/code/engine';
import { checkDataBlock } from '@texuli/blocks/data/engine';
import { checkEmbedBlock } from '@texuli/blocks/embed/engine';
import { checkInteractiveBlock } from '@texuli/blocks/interactive/engine';
import { checkMapBlock } from '@texuli/blocks/map/engine';
import { checkMediaBlock } from '@texuli/blocks/media/engine';
import { checkStructureBlock } from '@texuli/blocks/structure/engine';
import { checkTextBlock } from '@texuli/blocks/text/engine';
import { createPlayerCatalog, PLAYER_GRAMMAR_ROLES, withoutHostChrome } from '@texuli/player';

// The player builds this check internally (src/block-check.ts) and does not export it.
const checkBlock = createFamilyBlockCheck({
  'blocks-code': checkCodeBlock,
  'blocks-data': checkDataBlock,
  'blocks-diagram': diagramFamilyCheck,
  'blocks-embed': checkEmbedBlock,
  'blocks-interactive': checkInteractiveBlock,
  'blocks-map': checkMapBlock,
  'blocks-media': checkMediaBlock,
  'blocks-structure': checkStructureBlock,
  'blocks-text': checkTextBlock,
});

export const draftOptions = {
  catalog: withoutHostChrome(createPlayerCatalog()),
  tier: 'untrusted' as const,
  checkBlock,
  roles: PLAYER_GRAMMAR_ROLES, // the default roles plus the G20 layouts
  conditions: formulaConditions, // only needed when blueprints use `when`
};

const result = validateDraft(text, draftOptions);
if (!result.ok) {
  // result.diagnostics: check, code, severity, path, message, id
}
```

- **Catalog and hash.** `createPlayerCatalog()` is the player's default
  catalog. A host that ships its own catalog build uses
  `renderCatalogFromBuild(build)` and passes the build's hash as
  `catalogHash` to both `validateDraft` and `<Player>`; an envelope written
  for another catalog then fails with `catalog-mismatch`.
- **Envelopes.** `validateDraft` also reads a blueprint envelope
  ([envelope.md](../../catalog/docs/envelope.md)). Its result's `envelope`
  carries the status validation earned (`validated` or `draft`); the status,
  activation and tier the input declared are never trusted.
- **Local state.** A blueprint in the player's provisional
  `texuli-local-state` wrapper is resolved by the player before validation
  ([Local state](reference.md#local-state-g01)). `validateDraft` alone does
  not unwrap it; validate those through the player.

## 5. Edit with undo

`createEditHistory` from `@texuli/catalog/edit` applies the closed edit ops
(`insert`, `remove`, `move`, `setProp`, `unsetProp`, `replace`,
`replaceAll`) with undo, redo and coalescing
([edit.md](../../catalog/docs/edit.md)). Feed its tree to the player.

```svelte
<script lang="ts">
  import { createEditHistory } from '@texuli/catalog/edit';
  import { draftCommitGate } from '@texuli/catalog/validate';
  import { Player } from '@texuli/player';
  import { draftOptions } from './draft-options.ts';

  let { initial } = $props();
  const history = createEditHistory(initial, { validate: draftCommitGate(draftOptions) });
  let tree = $state(history.tree);
  history.subscribe((event) => {
    tree = event.tree; // event.ops replays the step on another copy
  });

  function rename(title: string) {
    // Typing in one field coalesces into one undo step.
    const result = history.apply({ op: 'setProp', path: [], name: 'title', value: title }, { coalesceKey: 'title' });
    if (!result.ok) console.log(result.error);
  }
</script>

<button type="button" disabled={!history.canUndo} onclick={() => history.undo()}>Undo</button>
<button type="button" disabled={!history.canRedo} onclick={() => history.redo()}>Redo</button>
<Player blueprint={tree} label="Draft" invalidPolicy="preview" />
```

- **Ops are untrusted input.** Every op is re-parsed before it applies
  (closed kinds, bounded paths, safe prop names, plain JSON values), and a
  batch is all or nothing.
- **Choose the commit gate.** The default gate is the tree limits only.
  `draftCommitGate(options)` runs the full `validateDraft` on every step, so
  no edit can leave the draft invalid. The builder instead uses a lighter
  gate (limits, its palette ids and manifest prop names) so a person can
  pass through invalid states while composing, and shows the player's
  diagnostics instead.
- **Undo restores stored trees.** `undo()` and `redo()` do not re-run the
  gate. A new apply clears the redo stack.
- **Paths are positions.** Nodes have no stable ids yet, so concurrent
  editors must rebase paths themselves; there is no merge.

## 6. Digest and activation

The player never activates a blueprint and has no activate method. Activation
is your own control, tied to what the owner reviewed.

```ts
import { blueprintDigest } from '@texuli/catalog/edit';
import { activateEnvelope, createValidationReceipt, verifyActivation } from '@texuli/catalog/envelope';
import { validateDraft } from '@texuli/catalog/validate';

const reviewedDigest = await blueprintDigest(envelope.tree); // shown to the owner at review time

const validation = validateDraft(envelope, draftOptions);
const receipt = createValidationReceipt(validation); // store it with the digest
if (validation.envelope?.status === 'validated') {
  const result = await activateEnvelope(validation.envelope, { by: 'person:owner', reviewedDigest });
  if (result.ok) {
    // result.envelope is `active` with activatedBy { by, at, digest }; store it.
    await verifyActivation(result.envelope); // later: the stored tree still has that digest
  } else {
    // result.code: 'not-validated' | 'not-active' | 'digest-mismatch' (the tree changed since review)
  }
}
```

- **The digest.** `blueprintDigest(tree)` is the lowercase hex SHA-256 of
  `canonicalBlueprintJson(tree)` (keys sorted at every depth, no whitespace),
  so key order does not change it. It is async (Web Crypto).
- **From the player.** `<Player>` does not expose a digest. The framework-free
  core does: `createPlayer(...).digest()` from `@texuli/catalog/player`
  resolves to the same digest of the validated tree, or `null` for an
  invalid draft. The builder's round-trip property test checks that the two
  agree.
- **Storage is yours.** Neither package persists or sends anything: you keep
  the receipt, the reviewed digest and the activated envelope. Any edit
  recorded with `recordProvenance` returns the envelope to `draft`.
- **Planned:** an activation digest over the declared local-state blueprint
  (today `digest()` covers the resolved tree), and stable node ids.

## 7. CSP

The player needs no `unsafe-inline` or `unsafe-eval`. Package sources use no
sink a strict policy blocks (`csp · sources` in `tests/e2e/csp.spec.ts`
scans them), and the player makes no requests of its own.

The registered player examples (`player-blueprint-preview`,
`player-dashboard`, `player-deck`) render with zero violations under the
fixture app's strict policy in that spec (last run for this guide on
2026-10-25, Chromium, 3 passed). Its directives are a reasonable starting
point:

| Directive | Why |
| --- | --- |
| `script-src 'self'` | Lazy painters are dynamic imports of same-origin chunks |
| `style-src 'self'` | The examples paint under it with no `unsafe-inline` |
| `require-trusted-types-for 'script'` with `trusted-types svelte-trusted-html` | Svelte's own template policy is the only one needed |
| `img-src 'self' data: blob:` plus your media hosts | Block images can be embedded `data:` files or relative paths; a `media-image` can be any HTTPS URL that passes the untrusted policy, so list the hosts you expect |
| `media-src 'self' blob:` plus your media hosts | Video sources. Add `data:` only if blueprints may embed video files |
| `connect-src 'self'` | The player makes no requests of its own |
| `frame-src` | `'none'` unless you use `<PlayerFrame>`; then list the frame page's origin |

A Texuli image whose source your policy blocks fails in the browser, not in
the player: the URL policy accepted it and the page refused it.

**Iframe embedding.** `<PlayerFrame>` renders a frame only for an HTTPS `src`
on your `allowedOrigins`, sandboxed without `allow-same-origin`. The frame
page's own CSP and `frame-ancestors` are the frame host's job. A hosted
player-frame page on a dedicated origin, with its own CSP, is planned, not
built.

## Not built yet

- Painting the catalog core's closed intents (`navigate`, `open-artifact`,
  `copy`, `export`, `request-fullscreen`). Action forms already propose
  intents to `onAction`.
- Retrying a failed node, stable node ids, merge or operational transform.
- A `@texuli/builder` package: the builder's palette, outline and inspector
  are website code today (builder design, open decision 1).
- A hosted player-frame page, and an end-to-end iframe test across real
  origins.

## Checks

```bash
pnpm vitest run packages/player
pnpm vitest run packages/catalog/tests/edit.test.ts packages/catalog/tests/player.test.ts
pnpm vitest run scripts/tests/site-builder-roundtrip.property.test.ts
TEXULI_E2E_PORT=4911 pnpm exec playwright test tests/e2e/csp.spec.ts -g "player-" --project chromium
```
