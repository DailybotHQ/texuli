# Document player core

**Package:** `@texuli/catalog`  
**Import:** `@texuli/catalog/player`  
**Tests:** `packages/catalog/tests/player.test.ts` (fixtures in `packages/catalog/tests/player-fixtures/`)

## Goal

The framework-free half of the player (player design §3–6). It turns an
untrusted blueprint, either a bare tree or an [envelope](./envelope.md), into
a paint plan a host can mount. It has no DOM, no Svelte and no Node APIs, so
the same core runs in a browser, a worker or a server. The Svelte paint is
[`@texuli/player`](../../player/README.md), which wraps this core; a host on
another framework passes its own loaders and a paint adapter.

## Pipeline

1. **Validate** with [`validateDraft`](./validate.md), at the tier the host
   chooses (`untrusted` by default), with the pinned `catalogHash`.
2. **Status.** The status is host input (`draft` by default, or `active`,
   `superseded`), never read from the blueprint. A draft that fails
   validation is `invalid`.
3. **Invalid policy.** `refuse` (default) paints a notice: `surface: 'notice'`
   and an empty plan, with `error` set to `parse`, `over-limits`,
   `catalog-mismatch` or `invalid`. `preview` paints the tree with visible
   placeholders.
4. **Plan.** Each render node becomes a `PaintNode`:
   - a component, whose props passed the **untrusted URL policy again at
     paint time**, at any depth (`href`, `src`, `poster`, `…Href`, `…Src`,
     `…Url`, and `srcset` / `…Srcset`, where every candidate URL must pass the
     image policy or the whole value is removed), whatever tier validated the
     tree. A child that fills a named slot (audit G04) keeps its `slot`, so
     the adapter mounts it in that snippet. Forbidden, event-handler and
     prototype keys are dropped at any depth, and so are values nested too
     deep to police. Everything removed is listed in `paintIssues`;
   - or a placeholder: `unknown-id` and `tier-denied` from the renderer, and
     `no-loader` when the host has no loader for the id.
5. **Paint** through a host `PaintAdapter`:
   - `paint(adapter)` waits for every loader;
   - `paintNow(adapter)` mounts what is loaded, shows `skeleton(node)` for
     the rest, and `subscribe` fires as loads settle.

   Loaders are lazy and per id: a report loads only the families it uses,
   and concurrent nodes with the same id share one load. A node whose loader
   rejects or whose mount throws becomes a `node-error` placeholder; its
   siblings and parent still paint.

```ts
import { createPlayer } from '@texuli/catalog/player';
import { formulaConditions } from '@texuli/catalog/render/conditions';

const player = createPlayer({
  blueprint,                 // text or data; always re-validated
  catalog,                   // renderCatalogFromBuild(build)
  catalogHash: build.hash,
  status: 'draft',           // host-owned
  loaders,                   // { 'blocks-text': () => import(…), … }
  conditions: formulaConditions, // optional: '@texuli/catalog/render/conditions'
  conditionInputs: { total: 42 },
});
const painted = await player.paint(adapter);
```

## Handle

| Member | What it does |
| --- | --- |
| `state` | `status`, `surface`, `error`, `plan`, `validation`, `paintIssues` |
| `update({ blueprint, status, catalogHash, conditionInputs })` | Re-validates and re-plans (new `conditionInputs` re-evaluate every `when`); pending intents are dropped |
| `receipt()` | `catalogHash`, `envelopeId`, `tier`, `ok`, `validationStatus`, `checks`, `errors`, `warnings` |
| `digest()` | A promise of the SHA-256 of the validated tree's canonical JSON (`blueprintDigest`), or `null` for an invalid draft |
| `propose` / `confirm` / `reject` / `intents()` | The closed intent queue (below) |
| `subscribe(listener)`, `dispose()` | Listen to changes; stop everything |

There is **no activate method**. Activation is the host's own control: it
compares `digest()` with what the owner reviewed and uses
`activateEnvelope` from the envelope subpath.

`receipt()` is the current host-computed validation receipt for the mounted
input. For envelope lifecycle records, `createValidationReceipt` captures the
same outcome with an envelope id and timestamp. The host associates that
receipt with the digest the owner reviewed and the `activatedBy` provenance;
neither the player nor this catalog package persists or publishes it.

`digest()` is async because Web Crypto is. The design draft showed it as
synchronous.

## Closed intents

A painted component may propose, and the host confirms or rejects. The
player never performs an intent.

| Kind | Payload | Check |
| --- | --- | --- |
| `navigate` | `href` | The untrusted URL policy; the host gets the normalized URL |
| `open-artifact` | `ref` | A short artifact id |
| `copy` | `text` | 1–4000 characters |
| `export` | `format` | `pdf`, `png`, `json` or `csv` |
| `request-fullscreen` | none | — |

Unknown kinds (there is no `activate` intent) and extra fields are refused.
An intent must name a painted component's path, a node may have at most 4
pending intents, and an invalid draft proposes nothing.

## Fixtures

The audit fixtures 02 (dashboard), 06 (slide), 07 (report) and 08
(proactive deck) validate at the untrusted tier with zero diagnostics, and
paint back node for node, props included, through a data adapter.

## Not yet

- The theme hook, declared intents in the blueprint, and state and
  expressions in this core (player design phases 1–3). `@texuli/player`
  layers a provisional local-state wrapper, controls, flows and action forms
  on top of it; see its README.
