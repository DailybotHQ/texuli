# Security — Texuli

Texuli is a **client-side** Svelte 5 component library and a **static** website.
It has no Texuli server, accounts database, or secrets store in the repository.
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
| **Control** | `safeHref` / `safeImageSrc` / `safeImageSrcset` / `safeMediaSrc` in `packages/core/src/url/` and `packages/core/src/url-policy/`. Both tiers block executable schemes after trim + control-char strip. Untrusted links: `https:`, `mailto:`, `#fragment` only. Untrusted media: `blob:` or HTTPS origins on an explicit allowlist. Rejected values return `undefined` (inert). |
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
| **Control** | Read-only tools only (`readOnlyHint: true`); catalog/component/example/validate/theme; stdio framing without stdout logs |
| **Tests** | `packages/tools/tests/mcp.test.ts` |
| **Residual** | Local stdio trusts the launcher process; no network authn. |

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
| **Tests** | `packages/chat/tests/thread.test.ts` |
| **Residual** | Not full Markdown; intentional. |

### 11. Website agent playground

| | |
| --- | --- |
| **Threat** | Huge paste DoS; executable hrefs; non-emittable dialogs as real UI |
| **Control** | Byte cap before `JSON.parse`; `renderCatalogTreeWithLimits`; host URL policy on props; untrusted tier; hostile presets |
| **Tests** | `scripts/tests/site-playground.test.ts`; E2E `tests/e2e/site-playground.spec.ts` |
| **Residual** | Demo surface; production hosts must wire the same pipeline. |

### 12. CSP and Trusted Types

| | |
| --- | --- |
| **Threat** | Package or example code using HTML sinks, eval, inline style attributes, arbitrary Trusted Types policies |
| **Control** | Enforced CSP on the fixture production build: `script-src`/`style-src` `'self'`; `require-trusted-types-for 'script'`; only `svelte-trusted-html`; probe + source scan + every registry example. Spec: `docs/quality/csp.md`, `tests/e2e/csp.spec.ts` |
| **Tests** | `tests/e2e/csp.spec.ts` (Playwright matrix) |
| **Residual** | Proven on the **fixture app**; consuming apps must set their own headers. Narrow WebKit `<select>` engine exception documented in the CSP doc. |

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

---

## What agents must not write into docs

Secrets, tokens, internal hostnames, real customer data, or private details of
other organizations’ systems. Describe generic design only. Do not name
third-party component libraries in product docs.

## Reporting

The repository's remote is `https://github.com/DailybotHQ/texuli.git`
(`git remote -v`), and GitHub reports it as public
(`gh repo view DailybotHQ/texuli --json visibility`, 2026-10-26). There is no
dedicated security reporting channel yet: report issues to the maintainers at
Dailybot directly, not in public issues.
