# Media URL policy (short)

| Trust | Typical allowed sources |
| --- | --- |
| `untrusted` (default for agent/user content) | `https:` from allowlisted origins where required; no `javascript:`, `data:` media, `vbscript:`, protocol-relative `//` |
| `developer` | App-authored assets: relative paths, `http(s):` as the texel allows; still blocks executable schemes |

Always:

1. Pass `src` / `poster` / track URLs through `safeImageSrc` or `safeMediaSrc`.
2. Prefer `allowedOrigins` on video/gallery when the host uses remote HTTPS.
3. For monorepo examples, use `import asset from './x.svg?url&no-inline'` so Vite
   does not inline small files as `data:` URLs that untrusted policy rejects.
4. Generator slot results are re-checked by the slot before paint; unsafe →
   `blocked`, never a live sink.

See `@texuli/core` docs and `packages/core/tests/url-policy.test.ts` for hostile
inputs (mixed case, whitespace, bidi smuggling).
