# Security — Texuli

Texuli is a **client-side** Svelte 5 component library and a **static** website.
The website also ships Cloudflare Pages Functions under `functions/` (a
request-shaping middleware and a same-origin analytics proxy, see
[section 15](#15-website-edge-functions-and-analytics); and the remote MCP
endpoint, in the repository for release 0.9.0 and not deployed yet, see
[section 21](#21-remote-mcp-endpoint); the middleware also fronts the
read-only JSON API under `/api/`, see
[section 23](#23-public-json-api-api)). The agent service
in `apps/agent` is a local implementation on a fake replay provider and is
not deployed ([apps/agent/README.md](../apps/agent/README.md)). There is no
other Texuli server, accounts database, or secrets store in the repository.
The real attack surface is **what components and agent trees render**: links,
images, media, catalog trees, and host-mounted embeds. This document states the
threat model, the controls that **ship today**, where they are enforced, the
tests that prove them, and residual risk.

Related detail: [CSP and Trusted Types](quality/csp.md),
[supply chain and SBOM](quality/supply-chain.md),
[embed blocks](../packages/blocks/docs/embed.md).

## Assets and trust tiers

| Input | Trust | Rule |
| --- | --- | --- |
| Props written by the consuming app’s developers | `developer` | Relative paths and non-executable schemes may be allowed; still no `javascript:` / `vbscript:` / smuggling forms |
| Content from a model, agent, or end user | `untrusted` (default) | Strict allowlists (HTTPS/mailto/fragment for links; media/image rules below) |
| Agent UI trees (catalog) | `untrusted` | Closed catalog, sink-free renderer, tree limits, grammar |
| CLI / MCP on a developer machine | local trust | Path containment; MCP tools are read-only |
| Requests to the JSON API (`/api/`) | `untrusted` | Public, anonymous, read-only static files: GET/HEAD/OPTIONS only, a rate limit, problem details that echo the path only as capped text ([section 23](#23-public-json-api-api)) |
| Requests to the remote MCP endpoint (`/mcp`) | `untrusted` | Public and unauthenticated: `edge` operations only, body, batch, item and time caps, a rate limit, Origin and Host checks ([section 21](#21-remote-mcp-endpoint)) |
| Third-party packages | supply chain | Lockfile + runtime allowlist + no install lifecycle scripts |

**Picking `developer` for agent or user content is a vulnerability.**

## Invariants (plan)

| Invariant | Meaning here |
| --- | --- |
| **INV-untrusted-inert** | Untrusted trees and media are validated and capped; no `{@html}`, `eval`, or `new Function` on data; URL policy on href/src |
| **INV-layers-down** | Dependencies point down the package layers; no host bypass via deep imports |
| **INV-local-only** | No push, publish, or remote deploy from agents until a human authorizes it |
| **INV-no-overlapping** third-party component runtimes | Owned stack only (no alternate component-library runtime dependency) |

## Rules for authors and agents

1. **No HTML sinks on data.** Never `{@html}`, `innerHTML`, `outerHTML`,
   `insertAdjacentHTML`, `eval`, `new Function`, or string-built `<script>` on
   props, content, or agent output.
2. **Every rendered URL passes the URL policy** (`safeHref`, `safeImageSrc`,
   `safeImageSrcset`, `safeMediaSrc`) with the correct tier.
3. **No `class` / `style` passthrough from untrusted catalog trees** (enforced
   by the sink-free renderer).
4. **Fictional data only** in tests, examples, and docs (`.example` /
   `example.com`). No real PII, secrets, or tokens.
5. **Never read or commit `.env` files** (gitignore + agent deny list).
6. **Supply chain changes** go through the lockfile owner only.
7. **Embed hosts** follow the [embed contract](#embed-blocks-mountembed) below.

---

## Trust boundaries (shipped)

### 1. URL policy (`@texuli/core`)

| | |
| --- | --- |
| **Threat** | Executable or smuggled URLs (`javascript:`, `data:` on links, protocol-relative, control characters in schemes); untrusted relative/http navigation; arbitrary media origins |
| **Control** | `safeHref` / `safeImageSrc` / `safeImageSrcset` / `safeMediaSrc` in `packages/core/src/url/` and `packages/core/src/url-policy/`. Both tiers block executable schemes after trim + control-char strip, and refuse protocol-relative values: any value opening with two of `/` and `\` (`//`, `/\`, `\/`, `\\`) or with any leading backslash, since browsers resolve `/\evil.example` to `https://evil.example/`. Untrusted links: `https:`, `mailto:`, `#fragment` only. Untrusted media: `blob:` or HTTPS origins on an explicit allowlist. Rejected values return `undefined` (inert). |
| **Enforced** | Every component and block that paints `href`/`src` must call these helpers (call-site discipline + catalog/playground re-checks). |
| **Tests** | `packages/core/tests/url-policy.test.ts` |
| **Residual** | A host that binds raw attributes bypasses the door. Allowed HTTPS hosts can still track (privacy, not script). |

### 2. Blocks untrusted-input guard (`@texuli/blocks`)

| | |
| --- | --- |
| **Threat** | Hostile block JSON (bidi/Trojan Source, NUL, oversized data-URIs, remote media, unknown types) becoming markup or network sinks |
| **Control** | Closed family schemas; `packages/blocks/src/core/safety.ts` (unsafe text + media classify: avatar / bounded data URI / relative extensions only — **no remote** block media); `parseUntrustedBlocks` / per-family `check*Block` |
| **Enforced** | Before any block renderer paints |
| **Tests** | `packages/blocks/tests/core.test.ts`, family suites (`text`, `media`, `code`, `structure`, `embed`, …) |
| **Residual** | Relative media paths resolve on the **host** origin (host static layout). |

### 3. Formula engine (`@texuli/blocks` core)

| | |
| --- | --- |
| **Threat** | String-eval calculators, host object access, prototype tricks, unbounded CPU |
| **Control** | Closed `op`-tagged AST (`packages/blocks/src/core/formula/`); pure interpreter, never throws; depth/args/exponent caps; unknown ops fail parse |
| **Tests** | `packages/blocks/tests/core.test.ts` (`formula AST`) |
| **Residual** | Deep-but-under-cap trees still cost CPU; hosts should debounce recompute. |

### 4. Catalog sink-free render (`@texuli/catalog`)

| | |
| --- | --- |
| **Threat** | Agent trees injecting HTML strings, handlers, `class`/`style`, unbounded depth/bytes, non-emittable chrome |
| **Control** | `renderCatalogTree` + `sanitizeProps`; unknown/tier-denied → placeholder; schema fail → drop; limits (depth/nodes/bytes/branching); grammar; richtext links via `safeHref`; hostile corpus |
| **Enforced** | `packages/catalog/src/render/**` before any host mounts components |
| **Tests** | `render-renderer`, `render-limits`, `render-grammar`, `render-richtext`, `render-frame`, `render-hostile` under `packages/catalog/tests/` |
| **Residual** | A host that widens the catalog tier or mounts outside the renderer undoes the control. |

### 5. Tools path containment and writers (`@texuli/tools`)

| | |
| --- | --- |
| **Threat** | `texuli add|init|update` / llms writer escaping the project via `..`, absolute paths, or symlinks |
| **Control** | `packages/tools/src/internal/paths.ts` — resolve under realpath root; refuse absolute/`..`; `lstat` refuse symlink destinations even with `--force`; registry path field validation |
| **Tests** | `cli-add.test.ts`, `cli-init.test.ts`, `cli-update.test.ts`, `llms.test.ts` |
| **Residual** | Compromised `cwd` outside the intended project is out of scope. |

### 6. MCP stdio server (`@texuli/tools`)

| | |
| --- | --- |
| **Threat** | Tools that write disk, run shell, or break JSON-RPC on stdout |
| **Control** | Every tool is a registry operation (`@texuli/tools/ops`): read-only annotations, a JSON Schema checked on input and output, and per-operation input, item and time caps; stdio framing without stdout logs and a 2 MiB line cap. The same operations run from a shell through `texuli <group> <verb>`, which reads one JSON object (stdin, `--json` or `--file`, each capped at the operation's input bytes before parsing) and writes `--out` only through the local write policy (`src/internal/local-write.ts`: an explicit path inside the working directory, no `..` escape, no symlinked component, a new file unless `--overwrite`). The server card and docs that describe the tools are generated from the registry (`pnpm check:surfaces`), so they cannot advertise a tool that does not exist |
| **Tests** | `packages/tools/tests/mcp.test.ts`, `mcp-protocol.test.ts`, `router.test.ts` (hostile input, oversized stdin and files, `--out` escapes), `scripts/tests/surfaces.test.ts` |
| **Residual** | Local stdio trusts the launcher process; no network authn. The remote HTTP door is [section 21](#21-remote-mcp-endpoint). |

### 7. Custom elements (`@texuli/tools/elements`)

| | |
| --- | --- |
| **Threat** | JSON attributes/trees carrying HTML or unsafe URLs into light DOM |
| **Control** | Parse never throws; trees through catalog renderer + limits; hostile assertions on `innerHTML` |
| **Tests** | `packages/tools/tests/elements.test.ts` |
| **Residual** | Host CSS can still style light-DOM children (not script). |

### 8. Golden scorer and A2UI (`@texuli/tools`)

| | |
| --- | --- |
| **Threat** | Agent “good” trees silently carrying sinks; A2UI bindings/templates as code |
| **Control** | Golden six-check scorer including sinks; A2UI schema refuses bindings/templates/function calls; depth limits; paint through sink-free path |
| **Tests** | `golden.test.ts`, `a2ui.test.ts` |
| **Residual** | Offline quality gates, not a runtime sandbox for arbitrary models. |

### 9. Media generator slot and media URL handling (`@texuli/media`)

| | |
| --- | --- |
| **Threat** | Host generator returns executable or non-allowlisted media URLs |
| **Control** | Results pass `safeImageSrc` / `safeMediaSrc` before paint; empty prompts refused |
| **Tests** | `generator-slot.test.ts`, `image.test.ts`, `video.test.ts` |
| **Residual** | Allowlisted HTTPS media can track; trust tier must be correct. |

### 10. Chat message formatter (`@texuli/chat`)

| | |
| --- | --- |
| **Threat** | Message text interpreted as HTML or `javascript:` links |
| **Control** | Inline subset only (`parseMessageText`); links via `safeHref(..., 'untrusted')` or literal text |
| **Tests** | `packages/chat/tests/logic.test.ts`, `packages/chat/tests/components.test.ts` |
| **Residual** | Not full Markdown; intentional. |

### 11. Website agent playground

| | |
| --- | --- |
| **Threat** | Huge paste DoS; executable hrefs; non-emittable dialogs as real UI |
| **Control** | Byte cap before `JSON.parse`; `renderCatalogTreeWithLimits`; host URL policy on props; untrusted tier; hostile presets |
| **Tests** | `scripts/tests/site-loaders.test.ts`; E2E `tests/e2e/site-playground.spec.ts` |
| **Residual** | Demo surface; production hosts must wire the same pipeline. |

### 12. CSP and Trusted Types

| | |
| --- | --- |
| **Threat** | Package or example code using HTML sinks, eval, inline style attributes, arbitrary Trusted Types policies |
| **Control** | Enforced CSP on the fixture production build: `script-src`/`style-src` `'self'`; `require-trusted-types-for 'script'`; only `svelte-trusted-html`; probe + source scan + every registry example. Spec: `docs/quality/csp.md`, `tests/e2e/csp.spec.ts` |
| **Tests** | `tests/e2e/csp.spec.ts` (enforcement probes, the built site's islands under their page policies, every registry example in four batches); the source scan is `scripts/tests/layers.test.ts`; the policy builder is `apps/website/tests/site-build-guards.test.ts`; every built route's hashes are `pnpm --filter @texuli/website check:csp` |
| **Residual** | Proven on the **fixture app**; consuming apps must set their own headers. Narrow WebKit `<select>` engine exception documented in the CSP doc. The website's own per-route CSP adds one more Trusted Types name, `texuli-analytics`, only on pages that mount the analytics loader (section 15). |

### 13. Supply chain

| | |
| --- | --- |
| **Threat** | Install lifecycle scripts; banned runtime deps; non-allowlisted externals; license drift |
| **Control** | `scripts/supply-chain.ts`: runtime external allowlist; banned packages; **no** install/uninstall lifecycle scripts on workspace manifests; SPDX allowlist; CycloneDX SBOM under `tmp/supply-chain/` (gitignored). `pnpm-workspace.yaml` `allowBuilds` only for known native tooling |
| **Tests** | `scripts/tests/supply-chain.test.ts` |
| **Residual** | Direct-deps SBOM only; no automated advisory audit yet (pre-publish gap). |

### 14. Embed blocks (`mountEmbed`)

| | |
| --- | --- |
| **Threat** | Host treats embed-app JSON as code; unsandboxed iframe; missing CSP / postMessage checks |
| **Control** | See [Embed blocks (`mountEmbed`)](#embed-blocks-mountembed) |
| **Tests** | `packages/blocks/tests/embed.test.ts` (schema, deferred Start, sandbox attributes, allowlist refusal) |
| **Residual** | Third-party widget isolation strength equals host CSP + allowlist + sandbox discipline |

### 15. Website edge functions and analytics

The website runs two Cloudflare Pages Functions and an opt-in analytics
loader. Analytics is **off by default**: with no `PUBLIC_UMAMI_WEBSITE_ID`
the loader tag is not rendered, the middleware sends no events, and with no
`UMAMI_ENDPOINT_ORIGIN` the proxy answers 503. Neither value is set in the
repository; both are owner-provisioned.

| | |
| --- | --- |
| **Threat** | The edge code handles every request: a hostile request shaping a response, a proxy used as an open relay or to serve a redirect target as same-origin script, oversized beacon bodies, request data (raw user agent, IP, query, search text, attacker-chosen paths) leaking into analytics events, and an analytics script that needs a script-URL sink under Trusted Types |
| **Control** | **Middleware** (`functions/_middleware.ts`): builds three kinds of answer; every other request goes through the static pipeline, and the middleware returns that asset response object untouched (no rebuilt copy, no added headers), so the `_headers` rules Cloudflare applies to it, the page CSP included, survive. `Vary: Accept` on every page that has a Markdown twin (every page but the 404 since PLAN_011 T-ar-twins) is emitted into `_headers` at build time (`varyHeaderLine` in `apps/website/src/components/security/csp.ts`), not added by the middleware. It serves a built markdown twin on an explicit `text/markdown` preference on any page path, relabels a `.md` file answered 200 as `text/markdown; charset=utf-8` with `nosniff` (the one pass-through it rebuilds: the `.md` files carry no CSP rule, and `/auth.md` loses only its `Cache-Control` line), the stripped `robots.txt` variant to audit tools, and, instead of the HTML 404 for agent user agents and Markdown-preferring requests, a fixed Markdown body (the missed path only as inert code, control characters and backticks removed, capped at 200 characters) or, under `/api/` and for JSON clients, an RFC 9457 `problem+json` body; every body comes from the build output or a fixed shape, and a twin that was not built falls through to the site's 404. It reads no request bodies. Bot events (`apps/website/src/lib/bot-events.ts`) count only known AI crawlers, unknown-bot heuristics and served twins, and fire only for HTML answers with status 200 (never 404s, redirects or errors); the payload carries the UA class and the path only, scrubbed of email-shaped values and capped at 256 characters, and the edge request sends its own `texuli-edge/1.0` user agent. Sends are fire-and-forget through `waitUntil` and never block the response. **Proxy** (`functions/api/umami/[[path]].ts`, `functions/_lib/umami-proxy.ts`, `apps/website/src/lib/umami-proxy-filter.ts`): exactly `GET script.js` and `POST api/send` pass (404 or 405 otherwise); the client's query string is not forwarded; the upstream origin comes only from the server-side env; only `content-type`, the client IP (as `x-forwarded-for`) and the user agent are forwarded, so cookies and authorization are dropped; beacons must be `application/json` (415) and at most 16 KB (413, the read stops at the limit); upstream redirects are never followed (`redirect: 'manual'`) and any non-2xx answer, or an unreachable upstream, becomes a 503 problem. **Client** (`apps/website/public/umami-loader.js`): skips audit-tool user agents, accepts only an `http(s)` script URL, sets it through the named Trusted Types policy `texuli-analytics`, which vouches for that one configured URL only, and tells the tracker to drop query strings and fragments. Outbound-link events carry origin and pathname only, and search events carry the query length and hit count, never the text. **CSP** (`apps/website/src/components/security/csp.ts`): `connect-src 'self'` (no foreign analytics origin), and `trusted-types` allows `texuli-analytics` only on pages whose HTML mounts the loader tag; every other page keeps `svelte-trusted-html` alone. |
| **Tests** | `apps/website/tests/umami-proxy.test.ts` (allowlist, 404/405/413/415, header allowlist, manual redirect and opaque redirect to 503, unreachable upstream), `apps/website/tests/edge-middleware.test.ts` (classes, 200-only HTML events, 256-character cap, scrub, off state, through the middleware), `apps/website/tests/analytics-client.test.ts` (Trusted Types policy, refused policy, audit skip, non-http source, query and fragment exclusion), `apps/website/tests/site-build-guards.test.ts`, `apps/website/tests/umami-wiring.test.ts`, (twin negotiation, pass-through responses returned as the same object, `varyHeaderLine` only on pages with a twin), ; E2E `tests/e2e/analytics.spec.ts` (default-off and per-route policy names; its zero-violation enabled-path test runs only against a fixture build with the loader mounted, which CI does not make) |
| **Residual** | **S-2, fixed in code (PLAN_006 T-100 follow-up):** in production, docs HTML lost its CSP because the middleware rebuilt those responses to add `Vary: Accept`, and Cloudflare Pages applies `_headers` only to the asset response, not to a response a Function builds. The middleware now returns pass-through responses untouched and `Vary: Accept` ships in `_headers`. The unit tests cannot model Cloudflare's header application, so a live check after the next deploy is still recommended: confirm `Content-Security-Policy` on a docs page with a twin, `/` and a component page, and `Vary: Accept` on the docs page. The bodies the middleware builds itself (Markdown twin, relabelled `.md` file, robots variant, Markdown and `problem+json` 404s) are not HTML pages and carry only the headers it sets. With analytics enabled, the upstream Umami service receives the client IP and user agent for its geo and device dimensions; Umami's default bot check may discard the bot-classed edge events unless `DISABLE_BOT_CHECK=1` is set on the Umami server, an owner post-deploy check, unverified against a live Umami ([site-analytics](../apps/website/docs/site-analytics.md)). |

---

## Embed blocks (`mountEmbed`)

Full host cookbook: [packages/blocks/docs/embed.md](../packages/blocks/docs/embed.md).

**Texuli guarantees**

- Does not evaluate embed-app JSON (plain JSON clone + caps only).
- Does not inject HTML from block data.
- Link-preview hrefs pass the untrusted HTTPS URL policy.
- Optional host helpers `createSandboxedEmbedIframe` /
  `createSandboxedEmbedMount` (`@texuli/blocks/embed`) set:
  - `sandbox` = `EMBED_IFRAME_SANDBOX` (**no** `allow-same-origin`; **no** `allow-popups-to-escape-sandbox` unless the host sets `allowPopupsToEscapeSandbox: true`)
  - `referrerpolicy` = `no-referrer`
  - `src` only if HTTPS and origin ∈ host allowlist

**Host must provide**

- CSP `frame-src` allowlist aligned with iframe origins.
- `postMessage` `event.origin` checks against that allowlist.
- Never relax the sandbox (especially never add `allow-same-origin` casually). `allow-popups-to-escape-sandbox` is opt-in only.
- No `innerHTML` / `{@html}` from `app` inside a custom `mountEmbed`.

Catalog id `blocks-embed` documents the same contract on `mountEmbed` and in
`dontUseWhen` / `a11y` guidance.

### 16. Interaction as data: spec 0.3.0 state, actions, drag and workflows

Released in the `0.4.0` packages; the `0.3.0` packages predate it.

| | |
| --- | --- |
| **Threat** | An agent blueprint that turns interaction into code: open-ended actions (fetch, navigate, eval), bindings that read or write anything, a drag that moves items the rules forbid, a form or control that validates but cannot paint (so validators and painter disagree), list item text that hides or reorders itself (bidirectional overrides, zero-width characters) once it can be dragged between lists, and workflow graphs as size or cycle bombs |
| **Control** | **Closed actions** (ADR-008): `on` maps only events the component declares to `setState`, `toggleState`, `moveItem`, `flowGo`, `emit` and `submit`, each with a closed field set; `emit` carries at most 32 scalar or `$state` values to the host's `onAction`, and the player sends nothing itself. **Bindings** read declared variables only (`$state`) or host data the host supplies (`$data`, read-only, whole top-level props only); `bind` writes back only `bindable` props to writable variables. **Drag as data**: `reorder` binds a declared list, and every move, keyboard or pointer, goes through one rule set (group and `accepts`, `locked`, `pull`, `maxItems`); the player's shared drag scope asks that rule set before a drop, so the UI cannot offer a move the data model refuses. **State surface parity** (`@texuli/spec/surface`): the spec validator, `@texuli/catalog`'s `validateDraft` and the Kotlin twin refuse exactly what `@texuli/player` refuses at paint time (form nodes outside an `action-form`, nested forms, controls and fields without a declared variable of their type, unmatched flow nodes, writes to host-bound variables), so a blueprint that validates always paints. **List item text** (`SPEC_PATTERNS.listText`): C0 and C1 controls, bidirectional overrides and isolates and invisible formatting characters are refused in list items by the spec, the catalog, the player's list parsing and Kotlin. **Workflow graphs**: closed node types and ports, at most 500 nodes and 2,000 edges, a cycle policy, label text without control or bidi characters, and link and image props through the `untrusted` URL policy |
| **Enforced** | `packages/spec/src/{validate,surface}.ts`, `packages/catalog/src/validate/interaction.ts`, `packages/player/src/state/**`, `native/texuli-spec/.../{SpecValidator,Surface}.kt`, `packages/workflows/src/model/**` |
| **Tests** | `packages/catalog/tests/render-hostile-blueprints.test.ts` (the 0.3.0 hostile corpus: workflow cycles, self-loops and 10,000 nodes, bidi in a workflow label and in draggable list items, `javascript:` in node text, oversized or smuggled `reorder`, unknown ids, props, events and actions, a form field outside a form, binding shapes, prototype keys; each refused with an expected code within 2 seconds and inert), `packages/player/tests/surface-parity.test.ts`, `packages/spec/tests/contract.test.ts`, the invalid fixtures `state-list-text`, `form-outside` and `surface-nodes` (TypeScript and Kotlin, `InvalidFixtureParityTest`), `packages/player/tests/{interaction,lego}.test.ts` |
| **Residual** | `emit` intents reach the host as data; what the host does with them (and whether it confirms them) is the host's responsibility. The player runs actions only in local state; persistence and authorization of a move belong to the application. ZWNJ and ZWJ stay allowed in list text for scripts and emoji. |

### 17. Linear-time parsing of untrusted text (ReDoS)

Released in the `0.5.0` packages; the `0.4.0` packages predate it.

| | |
| --- | --- |
| **Threat** | Agent or user text crafted to make a parser backtrack (regular-expression denial of service): a Markdown heading line of `# a`, 2,000 spaces and `x` once took over 20 s in the blocks parser, and an uncapped `<` followed by spaces or an `onon…` run made the catalog's draft sink scan quadratic. A single hostile string can freeze the page or a server render |
| **Control** | Parsers of untrusted text read lines and markers by index, not with overlapping quantifiers. `@texuli/blocks/text/markdown`: heading, fence and rule lines are scanned by hand, emphasis closers and bracket matches come from one table per source, link targets are read by index, and U+2028 and U+2029 end a line. `@texuli/core/editor-markdown` (and `@texuli/editor/markdown` over it): the heading closing sequence, fence info, list and quote lines are classified in linear time, link targets are read by index, and writing is linear. `@texuli/catalog` rich text: label, link-target, emphasis and backtick closers from per-source tables; trailing spaces and the HTML-tag check read by index. `looksExecutable` (the draft sink scan, which has no length cap) runs in linear time, and the scan's HTML-tag check no longer backtracks on spaces. Differential fuzzing (300,000 inputs for blocks, 400,000 for catalog rich text) matched the old parsers' output; the link-target scanner matched the old regex on 150,000 link-ish inputs (and both parsers on 20,000 link documents) |
| **Enforced** | `packages/blocks/src/text/markdown.ts`, `packages/core/src/editor/`, `packages/catalog/src/render/richtext/`, `packages/catalog/src/render/hostile/run.ts` (`looksExecutable`), `packages/catalog/src/validate/sinks.ts` |
| **Tests** | `packages/blocks/tests/text.test.ts` (14 hostile 4,000-character shapes, 100 ms each; three link-target whitespace runs, 20 ms each), `packages/core/tests/editor-markdown.test.ts` (47 link targets with 2,096-space runs at the 100,000-character cap under 200 ms), `packages/editor/tests/markdown.test.ts` (hostile input in bounded, linear time), `packages/catalog/tests/render-richtext.test.ts` (hostile runs at the 4,000-character cap under 20 ms), `packages/catalog/tests/render-hostile.test.ts` (an 8,000-character `on` run under 20 ms), `packages/catalog/tests/validate-sinks-linear.test.ts` |
| **Residual** | Time bounds in unit tests run on a shared, loaded host, so they are generous; a new parser or regular expression on untrusted text needs its own hostile-length test. Hosts that run their own parsers on agent text are outside this control. |

### 18. Streamed blueprints and motion as data

Released in the `0.6.0` packages (ADR-012, ADR-013, ADR-014); the `0.5.0`
packages predate it.

| | |
| --- | --- |
| **Threat** | An agent's blueprint arriving token by token, painted before it is complete: a half-written node that would fail validation once whole, a depth or size bomb, duplicate or prototype keys that change what a later parser sees, actions that run before the whole draft is judged, and an interrupted stream that leaves a partial interface looking final. Motion data as a channel for CSS, keyframes or timing abuse (a huge stagger) |
| **Control** | `@texuli/spec/stream` parses only: one pass with no backtracking or recursion, a byte budget (`DEFAULT_STREAM_MAX_BYTES`, the catalog's 256 KiB tree cap plus 8 KiB) and a depth cap (`DEFAULT_STREAM_MAX_DEPTH`, 128), and refusals at a UTF-8 byte offset for bad JSON, duplicate keys and `__proto__`, `constructor` and `prototype` anywhere. A node's shell is final only once `children` starts or the node closes; members after `children` hold the node. `validateStreamNode` (`@texuli/catalog/validate`) runs the node-level rules of `validateDraft` on the node's chain and the totals measured so far, so a node `validateDraft` would refuse never paints. `<Player stream>` keeps the stream busy and inert, keeps actions disarmed until `validateDraft` accepts the complete draft (still the only verdict), replaces the painted prefix with the refusal notice when the final draft is refused, and ends an interrupted stream as `interrupted`, never complete. Motion is a closed vocabulary (`@texuli/spec/motion`): presets, durations, staggers and levels by name only; the catalog refuses CSS, keyframes, milliseconds, unknown names and a huge stagger (`invalid-motion`), and the renderer drops the motion and keeps the node. The player plays motion through `@texuli/core/motion`, never on the server or on hydration, instant under reduced motion and level `none` |
| **Enforced** | `packages/spec/src/stream/`, `packages/spec/src/motion.ts`, `packages/catalog/src/validate/stream.ts`, `packages/catalog/src/render/renderer/render.ts`, `packages/player/src/stream/session.ts`, `packages/player/src/motion/`, `native/texuli-spec/.../runtime/Motion.kt` |
| **Tests** | `packages/spec/tests/stream.test.ts` (any chunking equals one chunk; depth and size bombs stop at their byte offset; doubling a large input stays near double the time), `packages/catalog/tests/validate-stream.test.ts` (every node-level rule, totals, refused subtrees), `packages/player/tests/stream-session.test.ts` (every `validateDraft` refusal is a refusal or an unpainted node while streaming; interruption at any offset keeps only admitted nodes), `packages/player/tests/streaming.test.ts`, `packages/catalog/tests/validate-motion.test.ts` (refusals and a wide hostile motion object in linear time), `packages/spec/tests/motion.test.ts`, the four `motion-*` invalid fixtures (TypeScript and Kotlin, `InvalidFixtureParityTest`) |
| **Residual** | A host that paints streamed text with its own code bypasses these checks. Partial paint is a preview: the person may read a node that the final verdict refuses; the player then replaces the prefix with the refusal notice. The agent service's provider adapters (`apps/agent`) are not deployed and have only run against recorded bytes. |

### 19. Documents as agent data, patches and collaboration

Released in the `0.7.0` packages (ADR-010, ADR-011, ADR-016), the first
release of `@texuli/document` and `@texuli/pages`; the `0.6.0` packages
predate it.

| | |
| --- | --- |
| **Threat** | A document from an agent, a file, a share link or a peer that smuggles markup, script URLs or prototype keys; a size, depth or node bomb; a wrapped block or component embed that the document validator does not understand; a patch that rewrites more than it says, touches `__proto__` or leaves an invalid document half applied; a remote sync batch that corrupts every replica; exported DOCX or PDF files that carry active content |
| **Control** | `@texuli/document/schema` validates every document (closed block and mark vocabulary, caps on blocks, characters, nesting and ids; `loadUntrustedDocument` caps bytes before parsing) and puts every link through `safeHref` and every media ref through `safeImageSrc` at the `untrusted` tier by default. `validateDraft` refuses every `document` node unless the host supplies `checkDocument` (`document-unchecked`), runs it at the host's tier, never the tier a draft claims, and checks wrapped blocks and component embeds again as catalog nodes (two-phase validation); a throwing host validator refuses. `patchDocument` carries at most 1,000 RFC 6902 operations, refuses prototype paths, applies all or none and validates the result again before the commit gate; malformed or repeated node keys are refused. Sync validates every remote batch before it integrates (and is not authorization: the host decides who writes). DOCX parts come from the escaped `@texuli/core/markup` builders and PDF strings are hex strings, with no JavaScript, forms or embedded files; `downloadBlob` opens only the `blob:` URL it creates |
| **Enforced** | `packages/document/src/schema/`, `packages/document/src/ops/`, `packages/document/src/sync/`, `packages/document/src/docx/`, `packages/document/src/pdf/`, `packages/catalog/src/validate/document.ts`, `packages/catalog/src/edit/ops.ts`, `packages/pages/src/host/document-host.ts`, `packages/pages/src/export/` |
| **Tests** | `packages/document/tests/schema.test.ts` (hostile and malformed documents with stable codes; the byte cap before parsing, in linear time), `packages/document/tests/sync.test.ts` (large and adversarial batches in linear time), `packages/document/tests/docx.test.ts`, `packages/document/tests/pdf.test.ts`, `packages/catalog/tests/validate-document.test.ts` (no validator, no document; hostile documents refused by the check that owns the rule; URLs at the host tier; linear on a hostile document; a throwing host validator; repeated keys), `packages/catalog/tests/edit-document.test.ts` (closed patch shape, all or none, inverse, linear time), `packages/pages/tests/host.test.ts` |
| **Residual** | A host that skips `checkDocument` gets no document at all, but a host that paints documents with its own code bypasses these checks. Network sync transports are the host's; the in-memory and `BroadcastChannel` adapters do not authenticate peers. |

### 20. Forms, data sources, canvases, sheets and static outputs

Released in the `0.8.0` packages (ADR-012, ADR-015, ADR-016), the first
release of `@texuli/forms`, `@texuli/canvas` and `@texuli/sheets`; the
`0.7.0` packages predate it.

| | |
| --- | --- |
| **Threat** | A form schema from an agent that carries a regular expression, code or an unbounded condition; field names that reach `Object.prototype` members; a blueprint binding that names a URL or an unregistered source; a canvas or sheet from an agent, a file or a peer with unknown shapes, raw CSS, bidi text, script URLs or size bombs; a formula that nests or recurses past the stack, references cells dynamically, or loops through a cycle; a CSV export whose cells run as formulas in another spreadsheet; email HTML or a printed PDF that carries active content |
| **Control** | Forms are a closed schema: named formats only (never a pattern), conditions and cross-field rules in the closed expression AST of `@texuli/core/expression`, evaluated with step, depth and size limits (`#LIMIT!` on overrun); field names that are `Object.prototype` members are reserved and values are read through own keys only. A blueprint `$source` binding names a source the host registered (`@texuli/core/data-source`) with a closed query; without the host's descriptors every binding is refused (`source`, `unknown-source`). `validateDraft` refuses `schema-form`, `canvas` and `spreadsheet` nodes unless the host supplies the check (`@texuli/forms/host`, `@texuli/canvas/host`, `@texuli/sheets/host`), at the host's tier. Canvases are validated by `@texuli/canvas/model` (closed shapes and token palette, no control or bidi text, image refs through the URL policy, `CANVAS_LIMITS`), and the presence store is capped. Sheets parse every formula at draft time into the closed grammar (54 functions, no dynamic references, operator chains counted toward the depth limit, step and graph budgets, `#CYCLE!` and `#REF!`); CSV export neutralizes formula injection. Dashboards keep widgets only directly in a dashboard, with unique ids and at most 200 widgets, and parse saved layouts as untrusted input. `@texuli/tools/email` writes escaped, table-based HTML with links at the `untrusted` tier; `@texuli/tools/print` writes a PDF from a validated blueprint through the `@texuli/document` writer |
| **Enforced** | `packages/core/src/expression/`, `packages/core/src/data-source/`, `packages/spec/src/source.ts`, `packages/forms/src/model/`, `packages/forms/src/host/`, `packages/canvas/src/model/`, `packages/canvas/src/sync/`, `packages/sheets/src/formula/`, `packages/sheets/src/model/`, `packages/sheets/src/csv/`, `packages/catalog/src/validate/form.ts`, `packages/catalog/src/validate/canvas.ts`, `packages/catalog/src/validate/sheet.ts`, `packages/catalog/src/validate/dashboard.ts`, `packages/tools/src/email/`, `packages/tools/src/print/` |
| **Tests** | `packages/core/tests/expression.test.ts`, `packages/core/tests/data-source.test.ts`, `packages/core/tests/data-source-loader.test.ts`, `packages/forms/tests/model.test.ts` (reserved and inherited names), `packages/canvas/tests/hostile.test.ts`, `packages/canvas/tests/sync.test.ts` (the capped presence store), `packages/sheets/tests/hostile.test.ts` (deep operator chains refused, not overflowing the stack), `packages/sheets/tests/formula.test.ts`, `packages/sheets/tests/csv.test.ts`, `packages/catalog/tests/validate-form.test.ts`, `packages/catalog/tests/validate-canvas.test.ts`, `packages/catalog/tests/validate-sheet.test.ts`, `packages/catalog/tests/validate-dashboard.test.ts`, `packages/catalog/tests/validate-source.test.ts`, `packages/tools/tests/email.test.ts`, `packages/tools/tests/print.test.ts` |
| **Residual** | A host that skips the form, canvas or sheet check gets no such node at all, but a host that paints them with its own code bypasses these checks. Data sources run the host's own code: the binding only names a source and a closed query. Canvas sync transports are the host's, as for documents. The native twin validates these shapes and paints a placeholder; evaluating expressions and formulas natively is planned. |

### 21. Remote MCP endpoint

PLAN_011 T-mcp-remote, [ADR-018](DECISIONS.md#adr-018-the-remote-mcp-on-pages-functions).
**Status:** in the repository for release 0.9.0; it is not deployed until
that release merges to `main` (texuli.com deploys from `main`), and it has
not run on Cloudflare's runtime yet.

| | |
| --- | --- |
| **Threat** | A public, unauthenticated endpoint that runs Texuli operations on request bodies from anyone: CPU and memory exhaustion (huge bodies, slow or endless streams, batch amplification, operations with large inputs or long runs, request floods), hostile JSON (malformed, invalid UTF-8, deep nesting, prototype keys, non-object messages), a browser page on another site driving the endpoint with a visitor's browser, DNS rebinding, operations that reach the file system or the network, responses rendered or cached as something else, and request data (arguments, IPs, user agents) leaking into logs or analytics |
| **Control** | **Routing:** `functions/mcp.ts` answers `/mcp`; the middleware answers `/.well-known/mcp` with the same server and passes `/mcp` to its Function untouched. **Transport:** stateless Streamable HTTP, `POST` JSON-RPC (one message, or a batch of at most 10) with JSON responses; no SSE stream, no session id, nothing kept between requests. A notification (or a client's JSON-RPC response) gets `202` with no body. `GET` and every other method get `405` with `Allow: POST, OPTIONS`, a docs pointer and a `Link` to the server card (agent user agents get the static server card as the body); `OPTIONS` answers CORS. **Operations:** the handler is `createMcpHandler({ mode: 'stateless', runtimes: ['edge'] })`; `node` operations (file writes, PDF and DOCX conversion) are not listed and answer `runtime-unavailable`, and every operation keeps its registry limits (`inputBytes`, item caps, time budget). **Limits, in order:** Host, then Origin, then a per-isolate token bucket keyed by `CF-Connecting-IP` (60 messages per minute per client, bursts up to 60; a batch costs one token per message; at most 10,000 clients tracked, oldest dropped first), `Content-Type: application/json` (`415`), an `Accept` that allows JSON (`406`), a supported `MCP-Protocol-Version` header (`400`), the body at most 256 KB (`413`, refused from `Content-Length` before reading, or as soon as the streamed count passes the cap, and the stream is cancelled), JSON parsed from strict UTF-8 (`400` with `-32700`), a non-empty batch of at most 10 messages (`400` with `-32600`), and a 5 s wall-clock guard per message (a `tools/call` past it is an `isError` result with code `timeout`; other methods get `-32603`). Rate-limited requests get `429` with `Retry-After`; every rate-checked answer carries `RateLimit-Policy: "mcp";q=60;w=60` and `RateLimit: "mcp";r=<remaining>;t=<seconds>`. **Origin and Host:** a request with an `Origin` header must come from `https://texuli.com`, `https://texuli.pages.dev`, a one-label preview host under `texuli.pages.dev`, or `http(s)://localhost` and `127.0.0.1` (local tests); `null` and every other origin get `403` and no CORS grant. A request without `Origin` (a server-side agent) is allowed. The URL host and the `Host` header must be texuli.com, a Pages host or a local host (`403` otherwise). **Headers:** the Function sets its own on every answer, because `_headers` does not apply to Function responses: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `Vary: Origin`, and for an allowed browser origin `Access-Control-Allow-Origin` with that origin (never `*`), the exposed protocol and rate-limit headers, and on preflight `POST, OPTIONS`, the four request headers it allows and a 600 s max age. Refusals outside JSON-RPC are `application/problem+json`. **Never:** a network fetch from an operation, storage, secrets, `eval`, HTML sinks, or logging; the request body is read only to parse it. **Counters only:** a request that reached the handler queues one `mcp_call` event through the same-origin analytics proxy via `waitUntil` (the existing bot-event path), only when analytics is provisioned: the operation label (a served tool name or a known method, `batch` or `unknown`, never an argument), the HTTP status and a duration bucket. Refused requests send nothing |
| **Enforced** | `functions/mcp.ts`, `functions/_lib/mcp-server.ts`, `functions/_lib/mcp-endpoint.ts`, `functions/_middleware.ts`, `apps/website/src/lib/bot-events.ts` (`buildMcpEventBody`), `packages/tools/src/mcp/handler.ts` |
| **Tests** | `apps/website/tests/mcp-function.test.ts` with real `Request` objects: `initialize` and `tools/list` (no `node` operation listed, each refused as `runtime-unavailable`), `tools/call` of `catalog.search` and `blueprint.validate`, operation caps (`input-too-large`, `invalid-input`), `resources/read` of `texuli://catalog`, batches and the batch cap, `202` notifications, an unsupported protocol header, a declared and a streamed oversized body (the stream stops after a few chunks), malformed JSON and invalid UTF-8, wrong `Content-Type` and `Accept`, prototype keys, 100,000-deep nesting, non-object messages, the Origin and Host tables, `403` for a foreign Origin and a wrong Host, the token bucket (`429`, `Retry-After`, RateLimit headers, per-message batch cost, refill, the key cap), the time guard, `GET` `405` for browsers and agents, preflights, every security header on every kind of answer, the `/.well-known/mcp` route, and counters (one event, no arguments or IP, `unknown` for an unknown tool, no fetch when unprovisioned). `scripts/tests/size.test.ts` covers the Function size entry |
| **Residual** | The token bucket is **best-effort**: it lives in one isolate's memory, Cloudflare runs many isolates and recycles them, so a client can get a multiple of the quota, and clients behind one address (a NAT, a hosted agent platform) share it. The time guard cannot preempt synchronous work: an operation that computes without yielding finishes before the guard fires, and Cloudflare's own CPU limit is the backstop. Durable limits in KV are planned and need a binding only the owner can create. Nothing here has run on Cloudflare yet: after the first deploy, check `POST /mcp` (`initialize`, `tools/list`), the headers above and a `GET` `405` on texuli.com. The CI job `mcp-remote-smoke` (pushes to `main` only, non-blocking) sends one read-only `tools/list` with curl after each deploy and compares the names with the registry; it checks no headers or limits. **Optional owner rule (Cloudflare dashboard, never changed by the plan):** a WAF rate-limiting rule on `(http.request.uri.path in {"/mcp" "/.well-known/mcp"} and http.request.method eq "POST")`, counting by IP, with the action Block (a challenge cannot be solved by an agent), for example 20 requests per 10 seconds; use a period and mitigation timeout the zone's plan allows. It is a stronger, cross-isolate layer in front of the Function's own limits |

### 22. Agent discovery files (texuli.com)

PLAN_011 T-ar-discovery. **Status:** in the repository for release 0.9.0;
served once that release deploys from `main`.

| | |
| --- | --- |
| **Threat** | Discovery documents that promise access the site does not grant (an agent tries to register, obtain or send credentials), headers that break their syntax or point off-site, a discovery file served as something a browser renders, and a security contact or expiry that goes stale |
| **Control** | Every file is generated at build from one typed source (`apps/website/src/components/seo/agent-discovery.ts`) and states what exists: **access is anonymous and read-only**, no account, registration, credential or token exists. The OAuth documents (`/.well-known/oauth-authorization-server`, RFC 8414, and `/.well-known/oauth-protected-resource`, RFC 9728) are **discovery stubs** with a `_comment` saying so; `scopes_supported` is `["read"]`; their authorization, token, register and claim endpoints are reserved paths that accept no request; `jwks_uri` is an empty key set because nothing is signed. `/auth.md` states the same, plus the MCP endpoint and its limits (from `apps/website/src/lib/mcp-limits.ts`, the numbers the endpoint enforces). The A2A card says Texuli runs no A2A agent and points at the MCP server; the Personal Agent Protocol manifest declares website-only discovery (no sessions, sign-in or APIs). `security.txt` (RFC 9116) takes its `Contact` from the root SECURITY.md at build and expires one year after the build. `Link` values are built from fixed paths and built file names; a target with whitespace, quotes, angle brackets, commas or semicolons, or one that is not root-relative or `https:`, fails the build. `_headers` gives each file its content type and `X-Content-Type-Options: nosniff`; CORS `*` is sent only on the public, read-only JSON documents. The middleware adds the same `Link` to the Markdown twins it builds (a Function response gets no `_headers` rule, S-2) and changes nothing else |
| **Enforced** | `apps/website/src/components/seo/agent-discovery.ts`, `apps/website/src/integrations/agent-discovery.ts`, `apps/website/src/components/security/csp.ts` (`linkHeaderLine`, the discovery rules in `_headers`), `functions/_middleware.ts` |
| **Tests** | `apps/website/tests/agent-discovery.test.ts` (fields, content types, the `read` scope, `Link` syntax and refused targets, `_headers` rules, security.txt expiry, robots directives), `tests/e2e/site-agent-discovery.spec.ts` (the built files with the generated rules applied), `apps/website/tests/edge-middleware.test.ts` (the twin's `Link`) |
| **Residual** | A stub endpoint that some client probes anyway gets the site's 404 (problem JSON for agents). The headers are checked against the generated `_headers`, not against Cloudflare's application of it; a scan after the deploy confirms them. A build older than a year serves an expired `security.txt`. |

---

### 23. Public JSON API (`/api/`)

PLAN_011 T-ar-api, [site-api](../apps/website/docs/site-api.md).
**Status:** in the repository for release 0.9.0; served once that release
deploys from `main`.

| | |
| --- | --- |
| **Threat** | A client hammering the API, a write method or a crafted path reaching something other than a built file, a hostile path reflected into a response, an HTML error page (or a script context) served under `/api/`, the API shadowing another Function under `/api/` (the analytics proxy), or documents that describe endpoints the build does not serve |
| **Control** | **Static data only:** every resource is a file the build writes (`/api/index.json`, `/api/health.json` and the site's own JSON files); nothing is computed per request and nothing is stored. The `/api/v1/` aliases are not files: `aliasSource` maps each to one source file, read from `env.ASSETS` (the same deployment, no network fetch); a path that maps to no resource is answered `404` without touching the asset store, and a path parameter must be a plain id (`^[a-z0-9]+(-[a-z0-9]+)*$`), so dots, slashes, encoded bytes or upper case can never name another file. **Envelope** (`functions/_lib/api-endpoint.ts`, called first by the middleware for `/api` and `/api/…`, except `/api/umami/…`): `OPTIONS` answers CORS; any method but `GET`, `HEAD` and `OPTIONS` gets `405` with `Allow`; then a per-isolate token bucket keyed by `CF-Connecting-IP` (`createTokenBucket` from the MCP endpoint; 300 requests per client per 60 s, at most 10,000 clients tracked, oldest dropped first) answers `429` with `Retry-After`; then the file is fetched from `env.ASSETS` by its (mapped) path (only `If-None-Match` and `If-Modified-Since` are forwarded, so a `304` works). A `200` or `304` is answered as JSON; anything else (a miss, the host's HTML 404, a failure) becomes RFC 9457 `application/problem+json` with a stable code, for every client: HTML is never returned under `/api/`. The problem's `instance` is the client's path with control characters removed and capped at 200 characters, as JSON string data. **Headers** (the envelope builds the response, so `_headers` does not reach it, S-2): `X-API-Version`, `RateLimit-Policy`, `RateLimit`, `Access-Control-Allow-Origin: *` (public, anonymous, read-only data; no credentials are ever accepted), `Access-Control-Expose-Headers`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Cache-Control` (problems: `no-store`) and a `Link` to `/openapi.json` and `/developers/`. The `/api/*` rule in `_headers` sends the version, CORS, `nosniff` and cache headers on the static `/api/index.json` and `/api/health.json` when no Function answers. **Description:** `/openapi.json` is generated at build and the build fails if an operationId repeats, a `$ref` does not resolve or a described path is not built. **Never:** a request body read, query parameters, storage, secrets or logging |
| **Enforced** | `functions/_middleware.ts`, `functions/_lib/api-endpoint.ts`, `functions/_lib/mcp-endpoint.ts` (`createTokenBucket`, `rateLimitHeaders`), `apps/website/src/lib/api-surface.ts`, `apps/website/src/lib/openapi.ts`, `apps/website/src/integrations/api-surface.ts` |
| **Tests** | `apps/website/tests/site-api.test.ts` (the alias mapping and hostile ids, an alias read from its source file, headers on every kind of answer, HEAD, 304, directory URLs, 404 for hostile and traversal paths with a capped clean `instance`, 405 for writes, preflight, 429 with `Retry-After` per client, 500 on an asset failure, the middleware route and the analytics-proxy exclusion, the OpenAPI checker), `apps/website/tests/edge-middleware.test.ts`, `tests/e2e/site-developers.spec.ts` (the real middleware in front of `dist`) |
| **Residual** | The limit is **best-effort**, as for the MCP: per isolate, shared by clients behind one address; durable limits need a KV binding only the owner can create. Without Functions there are no `/api/v1/` aliases at all; the static `/api/` files are served with the `_headers` rule but with no rate limit, and misses get the HTML 404. Nothing has run on Cloudflare yet: after the deploy, check `X-API-Version` and `RateLimit-Policy` on `/api/v1/health.json` and a problem body on a miss. **Optional owner rule (Cloudflare dashboard, never changed by the plan):** a WAF rate-limiting rule on `starts_with(http.request.uri.path, "/api/v1/")`, counting by IP, action Block, as a cross-isolate layer |

---

## What agents must not write into docs

Secrets, tokens, internal hostnames, real customer data, or private details of
other organizations’ systems. Describe generic design only. Do not name
third-party component libraries in product docs.

## Reporting

Report vulnerabilities privately, never in a public issue: the channel
(security@dailybot.com), what to include and the response targets are in
the root [SECURITY.md](../SECURITY.md#reporting-a-vulnerability).
