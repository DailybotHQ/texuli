# Embedding the player

**Package:** `@texuli/player` (private workspace package; not published as a
stable release)

How to put a validated catalog blueprint on a page: quick start, the props a
host controls, the trust badge and frame contract, localization, inactive
frames, and the four ways to embed. The package [README](../README.md) is the
reference for loaders, error placeholders, layouts, keyboard, local state and
the iframe protocol; [paint-proof.md](paint-proof.md) argues the security
property. To validate, edit, digest and activate blueprints around the
player, as the texuli.com builder does, read
[blueprint-flow.md](blueprint-flow.md).

## Quick start

```svelte
<script lang="ts">
  import { Player } from '@texuli/player';
  import '@texuli/player/styles.css';

  // A blueprint is catalog JSON: text or data, usually from an agent.
  const blueprint = {
    id: 'layout-page',
    props: { title: 'Weekly summary' },
    children: [
      {
        id: 'blocks-text',
        props: { block: { type: 'text', markdown: 'Fictional: **38 of 44** items closed.' } },
      },
    ],
  };
</script>

<Player {blueprint} label="Report preview" />
```

The root must be `layout-page`, `layout-doc` or `layout-deck`; any other
root is refused (`frame-root`). The player validates the blueprint at the
`untrusted` tier, shows the frame
chrome (label, lifecycle status and the **Untrusted content** badge), and
lazily loads only the painters the blueprint uses. Import
`@texuli/player/styles.css` when your bundler does not keep package CSS side
effects.

## Surface props

Every option belongs to the host. A blueprint can set none of them.

| Prop | Default | What it does |
| --- | --- | --- |
| `blueprint` | — | Catalog JSON as text or data. Re-validated on every change |
| `label` | `'Blueprint preview'` | Host name for the frame, shown in the chrome and used as its accessible name |
| `tier` | `'untrusted'` | Validation tier. Anything but exactly `'developer'` is `untrusted`. The untrusted URL policy applies at paint time either way |
| `status` | `'draft'` | Lifecycle badge you set: `draft`, `active` or `superseded`. The player shows `invalid` itself when validation fails |
| `invalidPolicy` | `'refuse'` | `refuse` shows a notice instead of an invalid tree. `preview` paints the validated placeholders under a warning and never activates |
| `catalog`, `catalogHash` | `createPlayerCatalog()` | The catalog to validate against, and the catalog build hash you pinned (an envelope built for another catalog fails) |
| `loaders` | `PLAYER_LOADERS` | Lazy painters per catalog id |
| `loadTimeoutMs` | `15000` | A loader that has not settled by then becomes a `node-error` placeholder. `0` turns the limit off |
| `dir`, `lang` | — | Direction and language of the player root. A `lang` that is not shaped like a BCP 47 tag is dropped |
| `labels` | English defaults | Chrome copy, merged per key (see [Labels](#labels-and-localization)) |
| `density` | `'comfortable'` | `compact` tightens chrome and spacing for chat surfaces |
| `active` | `true` | `false` makes the painted surface `inert` (see [Inactive frames](#inactive-frames)) |
| `composer` | — | A host snippet painted under the surface, outside the validated tree |
| `hostRegions` | — | Host snippets by region name, mounted where a `host-region` node names them, with no blueprint data (see [Host regions](../README.md#host-regions-r21)) |
| `initialState`, `onStateChange` | — | Local state seeds and snapshots for blueprints that declare state |
| `onDiagnostics` | — | Called after each validation with `{ status, surface, error?, diagnostics, receipt, stateIssues }`. `surface` is `'tree'` when the blueprint painted and `'notice'` when it was refused |
| `onResize` | — | Called with the root's border-box `{ blockSize, inlineSize }` |
| `onNodeError` | — | Called once per node that cannot paint, with `{ code, id, path, phase, error? }` |
| `landmarks` | `true` | `false` stops layout painters from emitting `<main>`; pass it when the player sits inside your own landmark |
| `motion` | `'auto'` | `auto` follows `prefers-reduced-motion`; `reduce` stops motion inside the player |
| `selectable`, `selection`, `onSelectionChange` | `false`, —, — | Frame selection for a builder-style preview ([Selection](../README.md#selection-builder-preview)) |
| `view`, `onFlowChange` | — | The flow view and its transitions ([Views and flows](../README.md#views-and-flows-g09)) |
| `onAction` | — | Answers action-form intents with `confirmed` or `rejected`; without it, actions are unavailable ([Action surface](../README.md#action-surface-and-receipts-g17)) |
| `dataSources` | — | Plain scalars for host-bound state variables ([Host data binding](../README.md#host-data-binding-host-g01)) |

## Trust badge and frame contract

The player is an **artifact frame**: agent output stays distinguishable from
your app's own UI.

- **Chrome.** The frame always shows your `label` and the lifecycle `status`.
  The blueprint cannot change or hide either.
- **Trust badge.** At the `untrusted` tier the chrome always shows
  **Untrusted content** (`labels.trustBadge`) next to the status, also while
  the frame is inactive. You can reword it but not remove it. The `developer`
  tier shows no badge.
- **Validation.** Every value that paints has passed `validateDraft` and the
  untrusted URL policy, on every entry path (blueprint object or JSON text,
  envelopes, local state and `setState`, `mountPlayer` updates and frame
  messages); see [paint-proof.md](paint-proof.md).
- **No side effects.** The player never activates, navigates, fetches or
  persists a blueprint. An action form only proposes an intent to your
  `onAction`; the catalog core's closed intents (`navigate`, `copy`,
  `export` and the rest) are not painted yet (planned).
- **Containment.** A node that cannot paint becomes its own placeholder; it
  never blanks the frame or throws into your page.

### Skip link

The first Tab stop is a skip link, "Skip past" plus your label
(`labels.skip`). It stays visually hidden until it receives keyboard focus,
and it moves focus to an end marker after the frame.

Unfocused, it is clipped to a 1 × 1 px box (`clip-path: inset(50%)`), so it
never shows over host content above the player. It expands in place when
focused. The full key map
(F6 between frames, arrows between frames, Escape walking outward) is in the
README's [Keyboard and focus](../README.md#keyboard-and-focus) section.

## Labels and localization

Pass `labels` to translate the chrome. Only non-empty strings replace a
default, so a bad override never blanks the chrome. Labels paint as text,
never as HTML.

| Key | Default |
| --- | --- |
| `status.draft` / `.active` / `.superseded` / `.invalid` | `Draft`, `Active`, `Superseded`, `Invalid draft` |
| `trustBadge` | `Untrusted content` |
| `skip` | `Skip past` |
| `loading` | `Loading` (prefix of each skeleton's announcement) |
| `invalidNotice` | `This blueprint could not be validated.` |
| `previewWarning` | `Preview only. This invalid blueprint cannot be activated.` |
| `placeholders.<code>` | Fixed copy per placeholder code |
| `position` | `Position` |
| `contents` | `Contents` (a document's table of contents) |
| `speakerNotes` | `Speaker notes` |
| `hostRegionMissing` | `Provided by the app; not available here.` (under the label of a host region the host does not provide) |
| `hostRegionDuplicate` | `Already shown above.` (under a second host region with the same name) |

```svelte
<Player
  {blueprint}
  label="Informe semanal"
  lang="es"
  labels={{ trustBadge: 'Contenido no verificado', skip: 'Saltar', status: { draft: 'Borrador' } }}
/>
```

`dir="rtl"` mirrors the chrome and the painted layouts. Some copy is English
only for now: placeholder names that come from the catalog core ("Unknown
component …") and the untitled card and slide names.

## Inactive frames

`active={false}` makes the painted surface `inert`: focus and pointer input
cannot reach it, which suits a background chat message or an off-stage
slide. The chrome, including the trust badge, stays visible. Loading
skeletons are always inert.

## Embedding

### 1. Svelte component

`<Player>` as in the quick start.

### 2. ES module, without Svelte

`mountPlayer(target, props)` mounts the same component into any element.

```ts
import { mountPlayer } from '@texuli/player';
import '@texuli/player/styles.css';

const player = mountPlayer(document.querySelector('#report')!, {
  blueprint,
  label: 'Report preview',
});

player.update({ status: 'active' }); // re-validates in place (a live update)
player.setState('week', 'Week 42'); // false when the variable is missing or the value does not fit
player.dispose();
```

`update` changes the props in place: declared state that still fits, the
flow view, the selection and loaded painters are kept, even when the
blueprint changes (see
[Live updates](../README.md#live-updates-r20)). To start over, `dispose()`
and mount again.

### 3. Script on a plain page

Use a `<script type="module">` processed by your bundler (for example Vite).
The package exports TypeScript and Svelte source, so it needs a build step.
There is no standalone browser bundle or CDN build.

```html
<div id="report"></div>
<script type="module">
  import { mountPlayer } from '@texuli/player';
  import '@texuli/player/styles.css';

  mountPlayer(document.getElementById('report'), {
    blueprint: { id: 'layout-page', props: { title: 'Weekly summary' } },
    label: 'Report preview',
  });
</script>
```

### 4. Third-party iframe

For a host on another origin, use `<PlayerFrame>` (or `createPlayerFrameHost`)
on the host page and `mountPlayerFrame` on the frame page. The frame is
sandboxed without `allow-same-origin`, and only display data crosses the
`postMessage` boundary. See the README's [Iframe frame](../README.md#iframe-frame)
section. A hosted frame page on a dedicated origin is planned, not built.

## Limits

- **Fidelity is structural, not pixel-level.** The golden fixture tests check
  the painted component tree, headings, frame stops and chrome, not pixels.
  Pixel baselines for the player examples (`player-blueprint-preview`,
  `player-dashboard`, `player-deck`) are committed in the visual suite
  (`tests/visual`); `pnpm visual -g player-` verifies them.
- **Provenance strip:** planned. The frame shows no provenance (who made the
  blueprint, from what) yet; the design's `provenance` frame option is not
  built.
- **Not built yet:** painting the core's closed intents, retrying a failed node, the
  slides presenter stage (decks paint as a document flow), a real-browser
  keyboard pass and a screen-reader pass.
- **Untrusted by default.** Choosing `tier="developer"` widens validation but
  never the paint-time URL policy.

## Testing

```bash
pnpm vitest run packages/player
pnpm --filter @texuli/player typecheck
pnpm vitest run packages/examples/tests/player-examples.test.ts
```
