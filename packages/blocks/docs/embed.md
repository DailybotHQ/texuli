# Embed blocks

**Package:** `@texuli/blocks` · **Import:** `@texuli/blocks/embed` (API) or
`@texuli/blocks/embed/renderers` (eager Svelte views)

The embed family renders two block types from **untrusted data**:

| Type | What paints |
| --- | --- |
| `link-preview` | Title, optional description/site, and a new-window link through the URL policy (`https:` only, no credentials) |
| `embed-app` | A **deferred shell**: title, idle copy, Start control, then a host mount region |

Texuli **never** evaluates embed-app JSON, never assigns HTML from it, and never
opens a network fetch for link previews. Rejected blocks become an inert notice.

## Entry points

| Import | What it gives you |
| --- | --- |
| `@texuli/blocks` | `loadEmbedFamily()`, `checkEmbedBlock`, `EMBED_BLOCK_TYPES`, … |
| `@texuli/blocks/embed` | Schema + labels + **sandbox host helpers** |
| `@texuli/blocks/embed/renderers` | `EmbedBlockView` (eager) |

## Host contract (`mountEmbed`) — F5

`EmbedBlockView` accepts an optional `mountEmbed(target, app)` callback. It runs
**only after** the user activates Start.

### What Texuli guarantees

| Guarantee | How |
| --- | --- |
| No execution of `app` JSON | Schema clones plain JSON only; no `eval` / `new Function` / HTML sinks |
| No nested embed-app payloads | Schema rejects nested `embed-app` and cycles; size/depth caps |
| Link previews stay on the URL policy | `safeHref`-class HTTPS checks; `rel="noopener noreferrer"` |
| A recommended sandboxed frame | `createSandboxedEmbedIframe` / `createSandboxedEmbedMount` set `sandbox` **without** `allow-same-origin`, `referrerpolicy="no-referrer"`, and refuse non-allowlisted HTTPS `src` |

Sandbox token constant: `EMBED_IFRAME_SANDBOX`  
Referrer policy constant: `EMBED_IFRAME_REFERRER_POLICY` (`no-referrer`)

### What the host must provide

| Host duty | Why |
| --- | --- |
| CSP `frame-src` allowlist matching the iframe origins you pass | Browser-enforced frame navigation |
| `postMessage` origin checks against that allowlist | Frames without `allow-same-origin` still script in an opaque origin |
| **Never** widen the sandbox (especially do not add `allow-same-origin` unless you accept full parent/frame coupling) | Same-origin escape hatch defeats the isolation Texuli documents |
| Keep `allow-popups-to-escape-sandbox` off unless required | Default sandbox omits it; pass `allowPopupsToEscapeSandbox: true` only when a product needs unsandboxed popups |
| Prefer `createSandboxedEmbedMount({ allowedOrigins })` for URL frames | Keeps attributes and allowlist checks consistent |
| Do not inject `app` fields with `innerHTML` / `{@html}` inside a custom mount | Bypasses the sink-free rule |

```ts
import {
  createSandboxedEmbedMount,
  type EmbedBlockViewProps,
} from '@texuli/blocks/embed';

const mountEmbed: NonNullable<EmbedBlockViewProps['mountEmbed']> =
  createSandboxedEmbedMount({
    allowedOrigins: ['https://widgets.example.com'],
  });
// Pass mountEmbed into EmbedBlockView. app.src must be https://widgets.example.com/…
```

If `mountEmbed` is omitted, Start shows the unavailable alert and nothing mounts.

## Tests

| File | Coverage |
| --- | --- |
| `packages/blocks/tests/embed.test.ts` | Schema hostility, deferred Start, link-preview policy, **sandbox iframe attributes + allowlist refusal** |

## Residual risk

Isolation of third-party widget **code** is only as strong as the host’s CSP,
allowlist, and refusal to relax sandbox. Texuli cannot enforce CSP headers in
the consuming app.
