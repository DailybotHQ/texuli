# Untrusted at paint: the player's security property

**Property.** Every value from a blueprint that reaches a painted
component, or the DOM, has passed `validateDraft` and the paint-time
**untrusted** URL policy. This holds whatever path the blueprint took into
the player. Nothing from a blueprint is ever handed to an HTML or code sink.

This page is the argument, path by path, plus what it does not cover. The
audit that checks it is `tests/untrusted-paint.test.ts`.

## The single paint funnel

Every blueprint, whatever its entry path, reaches the DOM through one
sequence in `Player.svelte` and the framework-free core
(`@texuli/catalog/player`):

1. **`validateDraft`** with the host's tier, `untrusted` by default. It
   checks, in order:
   - the byte cap before `JSON.parse`;
   - envelope fields;
   - tree limits;
   - closed ids: unknown or tier-denied ids become placeholders and are
     never components;
   - `sanitizeProps`: only declared props are kept, read with
     `Object.hasOwn`; forbidden names are refused; slot and event props are
     refused; HTML-looking strings and kind or enum mismatches drop the
     node;
   - block family schemas (`checkFamilyBlock`), grammar and the root rule.

   Under the default `refuse` policy, an invalid draft paints only a notice.
2. **The paint plan** (`createPlayer`). Each component node's props go
   through `paintProps`, at any depth:
   - every URL-bearing key (`href`, `src`, `poster`, `*href`, `*src`,
     `*url`) passes `safeHref` / `safeImageSrc` / `safeMediaSrc` with
     `'untrusted'`, **whatever tier validated the tree**;
   - forbidden keys (`class`, `style`, `innerHTML`, `outerHTML`, `srcdoc`,
     `dangerouslySetInnerHTML`), event-handler keys (`on*`) and prototype
     keys are dropped.
3. **The adapter** maps plan nodes to:
   - a painter from the host's loader map (host chrome ids such as
     `chat-composer` are removed first);
   - a placeholder (fixed copy plus a label, as text);
   - a skeleton (inert).

   A loader result that is not a component becomes a `node-error`
   placeholder.
4. **Svelte text interpolation** for every string the player itself
   renders: labels, diagnostics, state issues, placeholder labels that
   quote ids. The player source contains no `{@html}`, `innerHTML`,
   `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`,
   `new Function` or `srcdoc` (checked by a source scan in the audit).

## Entry paths and the gate each passes

| Entry path | How it reaches the funnel | Gate |
| --- | --- | --- |
| Blueprint object | `createPlayer({ blueprint })` | 1 → 2 → 3 |
| Blueprint JSON text | `validateDraft` byte-caps, then parses | 1 → 2 → 3 |
| ADR-003 envelope | `validateDraft` reads envelope fields strictly; status is never trusted | 1 → 2 → 3 |
| `tier: 'developer'` | Widens the allowed ids only; step 2 still applies `'untrusted'` URLs | 1 (developer) → 2 (untrusted) → 3 |
| `invalidPolicy: 'preview'` | Paints an invalid tree with placeholders; every painted node still goes through step 2 | 1 → 2 → 3 |
| Local-state wrapper | `splitStatefulBlueprint` (same byte cap), strict declarations, then `resolveStateBindings` produces a **literal** tree | wrapper checks → 1 → 2 → 3 |
| `setState` / `initialState` | Coerced to the declared type and bound (otherwise refused), then re-resolved and re-validated with `handle.update` | coercion → 1 → 2 → 3 |
| Host data (`dataSources`, `mountPlayer().update()`, frame `data`) | The frame message is re-parsed (`sanitizeDataSources`: named plain scalars only). Each value is coerced to its host-bound variable's declaration (else the initial value), then bound like any state value and re-validated in place (R20) | sanitize → coercion → 1 → 2 → 3 |
| `mountPlayer().update()` | Sets the merged props on the mounted `<Player>`, which re-validates the whole blueprint on the same handle (R20) | 1 → 2 → 3 |
| Frame protocol `init` / `update` | `parseHostMessage` re-parses; options are rebuilt from known values; the blueprint goes to `mountPlayer` | protocol parse → 1 → 2 → 3 |

**Why the state path cannot smuggle:**
- Bindings are replaced only inside `props`, never in `id` or structure.
- Each value is a typed scalar (`boolean`, `number`, `enum`, `string`). It
  is substituted **before** validation, so it meets exactly the checks a
  literal would (HTML strings, kinds, enums, URLs).
- A `"__proto__"` key in parsed prop data is kept as an own data property
  (`Object.defineProperty`), so the renderer sees and drops it. Before this
  task the resolver assigned it, which silently changed the object's
  prototype. A regression test covers it.

## Media policy

After the URL policy, `applyMediaPolicy` (`src/media-policy.ts`) narrows
media props. It never adds a URL:
- **Pinned trust:** `trust` on `media-image`, `media-composition-svg` and
  `media-composition-canvas` is pinned to `untrusted`. A blueprint value
  like `developer` would widen those components' own image policy: HTTP,
  blob and data sources, `srcset` (which is not a URL key for step 2), and
  placeholders. It would also drop `referrerpolicy="no-referrer"`.
- **Video:** a `blocks-media` video gets `autoplay: false` and
  `controls: true`.
- **Blank alt:** a blank `media-image` `alt` becomes the host's
  `labels.mediaNoAlt` (text only).

The audit asserts that no painted prop carries `trust` other than
`untrusted` or `autoplay: true`.

## Player-owned layout painters

`ContentLayout.svelte` is the one painter the player ships. It writes
blueprint values only through these guards:

| Painted from | Where | Guard |
| --- | --- | --- |
| `title`, `description`, `notes`, contents entries | Text nodes | Svelte text interpolation; HTML-looking strings were already refused by `sanitizeProps` |
| `columns` | `style` custom property | A finite number, clamped to 1–4 |
| `gap` | `style` custom property | Applied only when it matches a bounded length (`0`, `rem`/`em` up to 99.99, `px` up to 999); otherwise ignored. Strings with markup or `url(`/`javascript:` are usually refused earlier by the raw sink scan |
| `locale` (deck) | `lang` | `safeLang`: a BCP 47-shaped tag, or nothing |
| G20 `gap`, `align`, `wrap`, `ratio` (stack, row, split) | `data-*` attributes the CSS maps | Closed enums in the manifests (a free-text value fails `sanitizeProps`); the painter also falls back to a default token |
| G20 `span`, `rowSpan` (tile) | `style` custom properties | Finite numbers clamped to integers 1–4 and 1–2 |
| Heading rank | Element name `h1`–`h6` | Computed from the plan (`planFrames`), never read from props |
| Frame `id`, contents `href` | Attributes | Player-generated from `$props.id()` and the tree path; blueprint text (such as `slideId`) never becomes an id |

## What the audit asserts

`tests/untrusted-paint.test.ts` replaces every painter with a probe that
records the props it receives, on mount and on each later update.

**Corpus:**
- HTML strings;
- `javascript:` URLs with mixed case, whitespace, tabs and NUL;
- `vbscript:`, `data:text/html`, `data:image/svg+xml`, `file:` and
  protocol-relative URLs;
- handler, style and markup keys;
- prototype keys from JSON text;
- hostile ids (markup, `__proto__`, `constructor`, `toString`);
- malformed children;
- URLs nested in block data;
- binding objects outside a wrapper;
- media trust widening (`trust: "developer"` with an HTTP `srcset`) and
  muted autoplay with controls off.

The layout painter work added no entry path: layouts enter through the same
funnel, so the table above is unchanged. The corpus gained a hostile deck and
a hostile grid gap.

**Host data:** every hostile string also goes through `dataSources` (an
in-place update) and a frame `data` message into the same bound props.

**Paths:** each corpus tree runs through ten entry paths:
- object, JSON text, envelope, envelope inside a state wrapper;
- developer tier, invalid preview;
- state wrapper, state wrapper text;
- `mountPlayer().update()`, frame protocol `init`.

**Probe invariants:**
- no forbidden, handler or prototype key at any depth;
- no unsafe URL at a URL key;
- no top-level HTML string;
- no unresolved `{ "$state": … }` object;
- no foreign prototype on the props object.

**DOM invariants:**
- no `script`, `iframe`, `object`, `embed`, `img` or `svg` element was
  created;
- no `on*` attribute;
- no unsafe `href`, `src`, `action` or `formaction`, and no `srcdoc`.

**State smuggling:** every hostile string goes through `setState`,
`initialState`, a declared `string` initial and an `enum` value. Each is
bound into four props, two of them URL props. Wrong-kind and oversize values
are refused, and bindings in ids or children never rewrite structure.

A control test plants a violation to prove the checker is live, and checks
that a safe URL is recorded as painted.

**Layout painters, painted for real:** hostile layout trees run through the
real `ContentLayout` on the untrusted, developer and preview paths:
- a deck with a non-tag locale and a slide id that tries to clobber an id;
- doc contents built from hostile titles;
- grid gaps that try style injection.

On top of the DOM invariants, the audit checks that:
- every `style` matches the custom-property shape;
- every `lang` is a language tag;
- every `id` is a generated token;
- every in-page link points at an id in the same player.

A liveness test confirms these trees really paint frames.

## Trust boundaries and limits

- **Host-owned inputs are trusted as the host's:** `label`, `labels`,
  `composer`, `loaders`, `catalog`, `tier`, `dir`, `lang` and the
  frame-protocol options from an allowlisted parent origin. The player
  paints them as text or uses them as configuration; they are not blueprint
  data. `lang` is still shape-checked, and labels are text only.
- **A painter's own rendering** is that component's responsibility. Block
  families re-check their block data and render text; the audit replaces
  painters with probes, so their internals are covered by their own
  packages' tests, not here.
- **`tier: 'developer'`** allows more ids than `untrusted`. The URL policy
  at paint is untrusted either way. Choosing the developer tier is a host
  decision.
- **Not covered yet (planned):** a real-browser run of the audit (it runs in
  happy-dom today), a fuzzed corpus for the player (the catalog's hostile
  corpus has seeded fuzz rounds; the player audit uses a fixed corpus), and
  a CSP or Trusted Types check of a page that hosts the player.
