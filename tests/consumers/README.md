# Consumer apps

Real Vite, Astro and SvelteKit apps, each with and without Tailwind 4, that
install the packed tarball of **every packable package** and import **every
exported subpath**, the way an app installing from npm would. Nothing is
published: the tarballs are the ones `pnpm verify:packages` writes to
`tmp/packages/tarballs/`.

```bash
# Pack and check every package, then run the six apps (set your lane port)
pnpm verify:packages && TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/consumers/consumers.spec.ts --project chromium

# One app
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/consumers/consumers.spec.ts --project chromium -g sveltekit-plain

# The pure harness rules (subpath derivation, graph walker, diagnostics, generated files)
pnpm vitest run scripts/tests/consumers-harness.test.ts

# The same six apps against the published version on the npm registry (needs the network)
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/consumers/consumers-registry.spec.ts --project chromium
```

`tests/consumers` as a path runs both specs, so it needs the network for the
registry one.

## The surface

`surface.ts` reads the source `package.json` of every packable package (the
packages `scripts/packages.ts` packs) and turns each `exports` key into an
import specifier. Nothing is listed by hand except the entries that cannot
run in a browser, in `NON_BROWSER_SUBPATHS`, each with its reason:

| Kind | What the apps do with it |
| --- | --- |
| `module` | Imported as a namespace by the generated `universe.generated.ts` and listed with its export count by `Universe.svelte`, in the server pass (SvelteKit prerender, the Astro island) and after hydration; type-checked |
| `css` | Imported by `universe.generated.ts`; every `.tx-*` class and `--tx-*` custom property the packed stylesheet defines must be in the built CSS |
| `tailwind-css` | A Tailwind 4 stylesheet (`@custom-variant`, `@theme`, `@utility`): imported by the Tailwind apps' own stylesheet after `@import "tailwindcss"`; a plain app has no Tailwind compiler for it |
| `astro` | Wraps `.astro` components, which only the Astro compiler resolves: imported by the generated `src/pages/subpaths.astro` in the Astro apps; type-checked everywhere |
| `node` | Imports Node built-ins (the `@texuli/tools` CLIs, `@texuli/catalog/build/node`): imported by a generated `node-check.mjs` in plain Node instead of a browser |

The harness walks each installed subpath's `dist/` import graph and fails
when the table and the graph disagree, so a browser entry that starts
importing `node:fs` fails instead of being moved out of the browser.

## What fails an app

For each app, `harness.ts` copies the fixture into `tmp/consumers/`, points
every Texuli dependency at its tarball and runs `npm install --offline
--ignore-scripts` (no `--legacy-peer-deps`). Then:

1. **Install:** a Texuli package that did not resolve from its `file:`
   tarball, or a third-party pin missing from the npm cache (`ENOTCACHED`:
   reported, never fetched).
2. **Installed graph:** an export key the packed manifest dropped, an export
   target or relative import with no file in the tarball, a bare import the
   package does not declare in `dependencies` or `peerDependencies` (it would
   only work inside the monorepo), a Texuli subpath that is not exported, or
   an entry in the wrong environment.
3. **Plain Node:** every `node` subpath, and every subpath that reaches no
   `.svelte` file and no stylesheet (about half), imported by Node's own ESM
   resolver, which is stricter than a bundler about extensions and
   conditions; every `bin` of every package run with `--help`.
4. **Types:** `tsc --noEmit` over every subpath except the `node` ones (CSS
   ones as side-effect imports, `skipLibCheck: false`,
   `noUncheckedSideEffectImports`, no local `*.css` ambient) in every app;
   `svelte-check` over the app, `Smoke.svelte`, `Packages.svelte` and the
   generated files in the Vite and SvelteKit apps. Diagnostics in
   third-party declarations (Astro's own types, for one) are counted and
   ignored. A Texuli diagnostic fails unless it is in `KNOWN_TYPE_DEFECTS`,
   and a listed defect that no longer reproduces fails as stale.
5. **Build:** `npm run build` (Vite client; SvelteKit server build and
   prerender; Astro static build with the server render of the islands).
6. **Browser** (Chromium): the subpath list is complete in the server HTML
   (SvelteKit, Astro) and after hydration, with the export counts plain Node
   saw; one component per UI package (`RENDER_CHECKS`) renders its text and
   has a loaded rule for one of its `tx-` classes; the Astro apps' subpath
   page lists every `astro` entry; `vite-plain` also runs the chart worker;
   no uncaught page error.

`Smoke.svelte` renders `@texuli/core`, `@texuli/primitives`, `texuli` and
`@texuli/data`; `Packages.svelte` renders the other UI packages;
`Everything.svelte` mounts both plus `Universe.svelte`. Registry mode mounts
`Smoke.svelte` alone: the every-subpath surface follows the workspace
`exports`, which a published version may predate.

Not covered here: the type check of the `node` subpaths (their declarations
reference `@types/node`, and the npm cache on this host cannot install it
offline: `undici-types` is not cached), `astro check` of the `.astro` pages
(needs `@astrojs/check` in the cache), WebKit, Firefox and phone renders of
the apps, and the dev servers (`vite dev`, `astro dev`).

## Fixtures

`fixtures/<framework>-<plain|tailwind>/` hold each app; `fixtures/versions.ts`
pins every third-party version exactly (no `^` or `~`). A fixture's
`file:PLACEHOLDER_<DIR>` dependencies are its registry-mode set; tarball mode
adds every other packable package. The SvelteKit apps use a `200.html`
fallback so the prerendered `index.html` survives for the server-render
check.

Tarballs are repacked automatically when one is missing or older than its
package's `src/`, `generated/`, `package.json` or `README.md`.

Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-consumers).
