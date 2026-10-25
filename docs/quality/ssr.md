# SSR and hydration smoke check

`tests/e2e/ssr.spec.ts` renders every registered example (150 in the
2026-10-25 build) with Svelte's server renderer in Chromium. It also server-renders the
public `Button` component, serves that HTML as the initial document, and
hydrates it in Chromium, WebKit and Pixel 7. The check verifies that hydration
keeps the server-created button node, preserves its accessible name, produces
no page errors and changes its box by less than half a CSS pixel. The button's
own stylesheet is included in the server document so the geometry comparison
measures hydration rather than a late stylesheet load.

On 2026-10-25, the rebuilt registry contained 150 examples. The fresh run
passed 2/2 on Chromium and Pixel 7 (`mobile`) against dev `852b8d2a`
(port 4964): both selected projects rendered the registered examples and the
public `Button` hydration case with no reported shift or page error. WebKit
was not selected in this run.

Run it with the lane's private Playwright port:

```sh
TEXULI_E2E_PORT=4840 pnpm exec playwright test tests/e2e/ssr.spec.ts
```

The repository currently has a Vite fixture app, not a SvelteKit fixture. The
check covers the registered examples' initial server render and one real
component's hydration path; it does not hydrate every example. Components
that render browser-only content after mount, such as responsive layouts,
need targeted coverage for their intended server fallback and post-mount
behavior.
