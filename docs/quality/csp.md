# Strict CSP and Trusted Types

**Spec:** `tests/e2e/csp.spec.ts` · **Task:** T-quality-csp (Task 230)

Every registered example renders under an **enforced** strict
Content-Security-Policy with Trusted Types required. On 2026-10-25, Chromium
and Pixel 7 reported **zero violations across all 150 registered examples**.
The production site build also serves page-specific hash-based CSP in both
enforcing and report-only headers. Texuli needs no `'unsafe-inline'`, no
`'unsafe-eval'`, no nonces and no HTML string sinks.

```bash
TEXULI_E2E_PORT=<lane port> pnpm exec playwright test tests/e2e/csp.spec.ts
```

## The policy

```text
default-src 'none';
script-src 'self';
style-src 'self';
img-src 'self' data: blob: <example media hosts>;
font-src 'self';
media-src 'self' blob: <example media hosts>;
connect-src 'self';
worker-src 'self';
frame-src 'none';
object-src 'none';
base-uri 'none';
form-action 'self';
require-trusted-types-for 'script';
trusted-types svelte-trusted-html
```

- **Scripts and styles come only from the app's own files.** `style-src` has
  no `'unsafe-inline'`, so `<style>` elements and `style` attributes are
  blocked.
  - Components style elements through CSSOM: `style.setProperty`,
    `style.cssText` and Svelte's `style:` directive, which CSP allows.
- **Built website islands:** Astro's inline bootstrap scripts are allowed by
  per-document SHA-256 hashes; the build emits an enforcing policy and a
  report-only policy on each route. `pnpm --filter @texuli/website check:csp`
  checks hash correspondence and unsafe-directive absence on every built
  route; the CSP spec checks home and theme island hydration under those
  policies, and that both policies observe an unauthorized style. Hashes
  authorize only the exact script bytes in each built page.
- **Trusted Types:** the only allowed policy is Svelte's own
  `svelte-trusted-html`. Svelte 5 uses it to turn compiled templates into DOM.
  Texuli creates no policy of its own and never needs one.
- **Images and media** also allow:
  - `data:` and `blob:`: placeholders, canvas exports, and previews of local
    files. They never execute.
  - The fictional hosts the examples use to demonstrate the URL policy and
    image fallbacks: `https://example.com`, `https://images.example.com` and
    `https://media.example.test`.

  A real app lists its own media hosts instead. Nothing here allows a script
  or a style.

## How the spec works

- **It checks the production build.** The Vite dev server injects `<style>`
  from JavaScript, which this policy blocks, so dev mode cannot run under it.
  - The spec builds the fixture app (`tests/fixtures/app`) once per run, into
    `test-results/port-<port>/csp-builds/`. The workers share that build, and
    builds from finished runs are pruned.
  - It serves the build through Playwright routing on the configured origin,
    with the policy as a response header, so no extra port or server is used.
- **It proves the policy is enforced.** A module served from `'self'` runs as
  real page code; `page.evaluate` is exempt from CSP, so it can't be used.
  The module checks that:
  - raw `innerHTML`, `insertAdjacentHTML` and an unlisted Trusted Types policy
    each throw `TypeError`
  - `eval` and `new Function` throw `EvalError`
  - an injected `<style>` and a `style` attribute are not applied
- **It checks every example.** The example list comes from the registry,
  dealt into four tests that each walk their examples in one page session
  and run in parallel. Each example must render and load, then the spec
  waits for the network to go idle. The test fails on any `securitypolicyviolation` event, any CSP or
  Trusted Types console message, or any page error.
- **The sources are scanned** by a Vitest test
  (`scripts/tests/layers.test.ts`, "package sources under a strict CSP"),
  which reads every `packages/*/src` file and fails on any of these:
  - a `style` attribute write
  - an HTML string sink
  - `document.write`
  - `{@html}`
  - `eval` or `new Function`
  - a string timer
  - `srcdoc`

## Findings fixed at the source

- **`@texuli/core/announcer`** hid its live regions with
  `setAttribute('style', …)`, which `style-src-attr` blocks. It showed up in
  10 examples (every one with an announcer).
  - It now uses `style.cssText`.
  - `packages/core/tests/announcer.test.ts` asserts that no `style` attribute
    is written.
  - With the original code restored, the spec fails on those examples and on
    the source scan.

## WebKit engine exception (self-expiring)

In Playwright's WebKit (27.2), **every native `<select>`** on a page with
`style-src 'self'` reports a `style-src-attr` violation. It also logs
"Refused to apply a stylesheet". This happens even for a static `<select>` in
plain HTML with no script. Chromium reports nothing, and no code writes a
style.

- **What the spec sets aside:** only that exact report, on WebKit, with
  `style-src-attr` as the directive, on a `SELECT` element that has no
  `style` attribute. Its console line is set aside too.
- **The canary:** on WebKit, the enforcement test appends a bare `<select>`
  and asserts that WebKit still reports it. When WebKit stops, the canary fails and the exception
  should be removed.
- **What stays the same:** the policy itself is never loosened.

## Measured (2026-10-25, dev `852b8d2a`, port 4963)

| Project | Result |
| --- | --- |
| Chromium | 150 examples, zero violations; production hash policy and island hydration checks pass |
| Mobile (Pixel 7) | 150 examples, zero violations; production hash policy and island hydration checks pass |

The run passed 314 tests and skipped two by project selection (the native-select
WebKit canary is intentionally unselected in this Chromium/mobile run). WebKit
was not run today, so its native-select exception canary is not freshly verified. The
earlier three-project run on 2026-10-23 covered 131 examples per browser; that
historical result does not extend today's WebKit coverage. Today's run also
exercises enforcement probes, source scan, report-only violation reporting,
and changed-script hash checks.

## Limits

- **Initial render only.** Each example is checked as it first renders. Paths
  that only run after interaction (opening every overlay, editing every
  field) are not driven. Their sinks are covered by the source scan and by
  the shared texels.
- **Dependencies:** the source scan reads Texuli's own sources; dependency
  code is covered only by the browser checks.
- **Firefox** is not run; Playwright's Firefox doesn't launch on this macOS.
