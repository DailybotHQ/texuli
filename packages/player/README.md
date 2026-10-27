# @texuli/player

The Svelte 5 paint runtime for agent-built interfaces in
[Texuli](https://texuli.com), an MIT-licensed Svelte 5 component library by
Dailybot, Inc. (*Small pieces. Infinite possibilities.*). Hand
`<Player>` a blueprint (catalog JSON, usually written by an agent) and it
validates the blueprint, then paints it with real Texuli layouts, content
blocks, charts and media. HTML sinks never touch the blueprint. Agent
output stays inside a labelled frame with a visible trust badge, and the
player never navigates, fetches or persists anything on its own.

> **Status: preview.** Texuli is in development. The packages are published
> to npm as prereleases under the `next` dist-tag, and there is no stable
> release yet, so install with `@next`. APIs may still change between
> previews.

## Install

```bash
npm install @texuli/player@next svelte
```

Svelte 5 (`^5.57.2`) is a peer dependency. The validation core
(`@texuli/catalog`) and the blocks, charts and media painters are installed
as dependencies. Import the stylesheet once if your bundler does not keep
package CSS side effects:

```ts
import '@texuli/player/styles.css';
```

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

The root must be `layout-page`, `layout-doc` or `layout-deck`. The player
validates at the `untrusted` tier by default, shows the frame chrome (your
label, the lifecycle status and an **Untrusted content** badge), and loads
only the painters the blueprint uses.

Without Svelte, mount it from plain JavaScript:

```ts
import { mountPlayer } from '@texuli/player';

const player = mountPlayer(document.querySelector('#preview')!, {
  blueprint,
  label: 'Report preview',
});
player.update({ blueprint: nextBlueprint }); // re-validates in place
player.dispose();
```

## What's inside

Everything is exported from the root entry, `@texuli/player`.

| Area | Headline exports |
| --- | --- |
| Svelte component | `Player`, with host-owned props for tier, status, labels, density, motion, selection and callbacks |
| Plain JavaScript | `mountPlayer` (`update`, `setState`, `getState`, `dispatchFlow`, `getView`, `dispose`) |
| Catalog and loaders | `createPlayerCatalog`, `PLAYER_LOADERS`, `withLoadTimeout`, `skeletonFamily` |
| Error placeholders | `PLAYER_NODE_ERROR_CODES`, `placeholderMessage` |
| Labels and localization | `DEFAULT_PLAYER_LABELS`, `resolvePlayerLabels` |
| Local state and flows | `parseStateDeclarations`, `parseFlowDeclaration`, `resolveStateBindings` |
| Action forms | `runAction`, `actionValues`, `AUTOCOMPLETE_ALLOWLIST` |
| Host data and regions | `sanitizeDataSources`, `hostRegionManifest`, `HOST_CHROME_IDS` |
| Iframe embedding | `PlayerFrame`, `createPlayerFrameHost`, `mountPlayerFrame`, `createPlayerFrameClient` |
| Media policy | `applyMediaPolicy`, `TRUST_PINNED_IDS` |
| Stylesheet | `@texuli/player/styles.css` |

The TypeScript declarations list the full surface.

## Key guarantees

- **Validated before it paints.** Every blueprint value that paints has
  passed `validateDraft` from `@texuli/catalog` and the untrusted URL
  policy, on every entry path: the prop, `mountPlayer` updates, local
  state, host data and iframe messages. Choosing `tier="developer"` widens
  validation but never the paint-time URL policy.
- **No HTML sinks.** The player paints through components and never uses
  `{@html}` or `innerHTML`. Layout props are closed enums, clamped numbers
  or bounded lengths.
- **Visible trust boundary.** At the `untrusted` tier the frame always
  shows the trust badge. A host can reword it but not remove it.
- **Fails per node.** Invalid drafts are refused with a notice by default.
  A node that cannot load or paint becomes its own labelled placeholder
  and never blanks the page or throws into it.
- **No side effects.** Controls write local state only. An action form
  proposes an intent to your `onAction` handler, and the player sends
  nothing itself.
- **Accessible frame.** A skip link, F6 between frames, Escape walking
  outward, `inert` for inactive frames, one polite live region, and reduced
  motion honored.
- **Strict CSP friendly.** No `unsafe-inline` or `unsafe-eval` is needed,
  and the player makes no network requests of its own.
- **Sandboxed iframes.** `PlayerFrame` renders only an HTTPS `src` on your
  allowlist, sandboxed without `allow-same-origin`. Every message is
  re-parsed and size-clamped on both sides.

Not built yet: painting the catalog core's closed intents (such as
`navigate` or `copy`), retrying a failed node, and a hosted player-frame
page. Decks paint as a document flow; the slide-by-slide presenter stage
lives in `@texuli/slides`.

## Documentation

- Website: [texuli.com](https://texuli.com), the
  [blueprint builder](https://texuli.com/builder/) and the
  [agents overview](https://texuli.com/agents-page/)
- Embedding guide (start here): [embedding.md](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/embedding.md)
- Validate, edit and activate around the player: [blueprint-flow.md](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/blueprint-flow.md)
- Full reference (loaders, layouts, keyboard, state, flows, actions, iframe protocol): [reference.md](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/reference.md)
- Security property: [paint-proof.md](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/paint-proof.md)
- Security model: [SECURITY.md](https://github.com/DailybotHQ/texuli/blob/main/docs/SECURITY.md)

## Related packages

- [`@texuli/catalog`](https://www.npmjs.com/package/@texuli/catalog): the catalog, draft validation and the sink-free renderer the player is built on.
- [`@texuli/slides`](https://www.npmjs.com/package/@texuli/slides): presentation decks with a presenter stage.
- [`@texuli/tools`](https://www.npmjs.com/package/@texuli/tools): custom elements for hosts that do not use Svelte.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc.
