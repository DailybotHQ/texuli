# Avatar

**Package:** `@texuli/primitives` · **Import:** `@texuli/primitives/avatar`

Headless Svelte 5 avatar: image loading status with a delayed reveal and a
fallback. Image URLs go through `@texuli/core/url-policy` `safeImageSrc`. Parts:
`Avatar.Root`, `Avatar.Image` and `Avatar.Fallback`.

## API

```svelte
<script lang="ts">
  import { Avatar } from '@texuli/primitives/avatar';
</script>

<Avatar.Root delayMs={200} aria-label="Ada Example">
  <Avatar.Image src="https://cdn.example/ada.webp" alt="Ada Example" />
  <Avatar.Fallback>AE</Avatar.Fallback>
</Avatar.Root>
```

| Part | Role |
| --- | --- |
| `Avatar.Root` | Owns `loadingStatus` (`loading` \| `loaded` \| `error`) and `delayMs` |
| `Avatar.Image` | Validates `src` with `safeImageSrc`; reports load/error |
| `Avatar.Fallback` | Shown while loading, during delay, or after error |

### Root props

| Prop | Default | Notes |
| --- | --- | --- |
| `delayMs` | `0` | Wait after load before `loaded` (keeps fallback visible) |
| `loadingStatus` | `"loading"` | Bindable; `"loaded"` / `"error"` also set by Image |
| `onLoadingStatusChange` | — | Status callback |
| `child` | — | Composition snippet |

### Image props

| Prop | Default | Notes |
| --- | --- | --- |
| `src` | — | Validated; unsafe values force `error` |
| `srcTrust` | `"untrusted"` | `safeImageSrc` trust (`developer` allows data URIs) |
| `alt` | `""` | Host supplies a real name when the image is meaningful |

## Behavior

1. Mount / `src` change → status `loading`, Fallback visible, Image loads (hidden).
2. Load event → after `delayMs`, status `loaded`, Image shown, Fallback removed.
3. Error or rejected `src` → status `error`, Fallback stays, Image removed.

`data-state` on Root, Image and Fallback mirrors the status.

## Size

Lazy subpath `@texuli/primitives/avatar`: 2.53 KiB gzip (`pnpm size`, 2026-10-24), within the
4 KiB default for a primitive but above the task's 1.5 KiB target.
