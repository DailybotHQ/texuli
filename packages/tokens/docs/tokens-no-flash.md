# No-flash appearance bootstrap

`@texuli/tokens/no-flash` caches the last resolved appearance and produces an
inline script body that replays it before stylesheets paint. The cache key is
scoped to the application namespace, so separate prototypes can share an
origin without sharing appearance state.

```ts
import {
  cacheAppearance,
  noFlashScript,
  type AppliedAppearance,
} from '@texuli/tokens/no-flash';

const applied: AppliedAppearance = {
  themeId: 'ocean',
  mode: 'dark',
  vars: { '--tx-background': '#101820', '--tx-foreground': '#f7f9fb' },
};
cacheAppearance('billing', applied);

// Place this body in the document head before stylesheets.
const scriptBody = noFlashScript('billing', 'system');
```

The generated body has no `<script>` wrapper, is deterministic for a given
namespace and fallback, and can be hashed for a CSP `script-src` directive.
It replays only custom properties with `--tx-` names and rejects values with
declaration or markup delimiters. Theme ids, mode names, motion, surface and
component metadata are independently allowlisted. Storage access and malformed
cache data fail closed; with no usable cache the script resolves `system` to
the user's preferred contrast or color scheme, or uses the configured
`light`, `dark` or `high-contrast` fallback.

The cache stores the resolved mode and the variables already applied by the
runtime, which makes the prior appearance available immediately during startup.
Call `cacheAppearance(namespace, applied)` whenever the runtime applies a new
theme or mode. The namespace is part of the script body, so changing it also
changes its CSP hash.
