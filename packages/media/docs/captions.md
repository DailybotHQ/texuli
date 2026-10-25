# Captions and chapters

**Package:** `@texuli/media` · **Import:** `@texuli/media/captions`

WebVTT captions and chapters with a chapter menu, transcript view and active
caption line. Cue text is stripped to plain text (never `{@html}`). Track URLs
go through `safeMediaSrc`.

For authoring cues alongside a trim recipe, use `VideoEditPanel` and
`serializeWebVtt` from [`@texuli/media/video`](video.md). The serializer clips
to the trim range, re-times cues relative to the clip, and escapes cue text.

## API

```svelte
<script lang="ts">
  import { CaptionsPanel, parseWebVtt } from '@texuli/media/captions';
  const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
Welcome aboard.
`;
  let time = $state(0);
</script>

<CaptionsPanel {vtt} currentTime={time} onSeek={(t) => (time = t)} />
```

| Export | Role |
| --- | --- |
| `CaptionsPanel` | Active line + optional chapter menu + transcript |
| `ChapterMenu` | Keyboard chapter list |
| `TranscriptView` | Scrollable cue list with seek |
| `parseWebVtt` | Pure WebVTT → plain cues |
| `resolveCaptionSource` | Policy wrapper around `safeMediaSrc` |
| `loadCaptionTrack` | Fetch + parse a track URL |
| `chaptersFromCues` / `cuesAtTime` / `chapterAtTime` | Time helpers |

### Keyboard

- **Chapter menu / transcript:** Arrow keys move focus; Enter or Space selects/seeks; Home/End jump.

## Security

Untrusted track URLs must be `blob:` or HTTPS from `allowedOrigins`. Developer
trust also allows HTTP and relative paths. Cue payloads are plain text only.
