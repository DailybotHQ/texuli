# Embed blocks

> Validated link previews (URL policy) and embed-app shells. Texuli never runs app JSON; hosts mount via mountEmbed with a sandboxed iframe contract.

- **id:** `blocks-embed`
- **package:** `@texuli/blocks`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Show a deferred mini-app shell where the host mounts after user Start.
- Show an offline link preview with HTTPS-only href (URL policy).

### Don't use when

- Application navigation, account controls or mutations.
- Running untrusted app JSON with innerHTML, eval, or an unsandboxed iframe.
- Relaxing iframe sandbox (especially adding allow-same-origin) or skipping CSP frame-src / postMessage origin checks.

### Accessibility

- Start control is a real button; nothing loads until activation.
- Iframe title (when used) names the embedded app; host must keep keyboard access inside the frame.
- Link previews use rel=noopener noreferrer on new-window links.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `block` | object | yes | untrusted | — | Untrusted block data validated by the component before rendering. |
| `mountEmbed` | event | no | — | — | Host runtime after user Start. Prefer createSandboxedEmbedMount (sandbox without allow-same-origin, referrerpolicy=no-referrer, HTTPS allowlist). Host CSP frame-src + postMessage origin checks required; never relax sandbox or inject HTML from app data. |
| `labels` | object | no | — | — | — |
| `oninvalid` | event | no | — | — | Host-provided callback; omit when no host behavior is needed. |

### Examples

#### Embed blocks example (`basic`)

```json
{
  "block": {
    "type": "link-preview",
    "href": "https://example.com/guide",
    "title": "Product guide"
  }
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
