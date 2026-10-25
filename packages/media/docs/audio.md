# Audio player and waveform

**Package:** `@texuli/media` · **Import:** `@texuli/media/audio`

Accessible audio player with optional waveform peaks, keyboard seek, and
`safeMediaSrc` on every source. `data:` URLs are never accepted for media;
use HTTPS allowlists, relative developer assets, or blob URLs.

## API

```svelte
<script lang="ts">
  import { AudioPlayer, buildWaveformPeaks } from '@texuli/media/audio';
  const peaks = buildWaveformPeaks(samples, 64);
</script>

<AudioPlayer
  src={blobUrl}
  trust="untrusted"
  label="Harbor Notes demo clip"
  {peaks}
/>
```

| Export | Role |
| --- | --- |
| `AudioPlayer` | Play/pause, seek (waveform or slider), time labels |
| `Waveform` | Peak bars as a keyboard slider |
| `resolveAudioSource` | Policy wrapper around `safeMediaSrc` |
| `buildWaveformPeaks` | Pure peak downsampling |
| `decodeWaveformPeaks` | Fetch + decode into peaks (optional; does not apply URL policy — use `resolveAudioSource` first) |
| `formatAudioTime` | `m:ss` / `h:mm:ss` |

### AudioPlayer props

| Prop | Notes |
| --- | --- |
| `src` | Validated URL |
| `trust` | `untrusted` (default) or `developer` |
| `allowedOrigins` | HTTPS origins for untrusted remote media |
| `peaks` | Precomputed `[0,1]` bars; skips decode when set |
| `label` | Accessible name for the player region |

### Keyboard

- **Play button**: native activation (Space / Enter)
- **Waveform**: arrows (±2%, Shift ±10%), Home, End

## Security

Untrusted media must be a `blob:` URL or an HTTPS URL from `allowedOrigins`.
Developer trust also allows HTTP and relative paths. Never `javascript:`,
`data:`, or credentialed URLs.
