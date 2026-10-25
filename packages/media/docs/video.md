# Video player

**Package:** `@texuli/media` · **Import:** `@texuli/media/video`

Accessible custom-controls video player with optional WebVTT captions and
chapters. Caption UI loads lazily (`VideoCaptions.svelte`) so the video entry
stays within its bundle budget when no tracks are passed.

## Captions and chapters

```svelte
<VideoPlayer
  src={safeUrl}
  title="Harbor ferry"
  tracks={[
    { id: 'en', label: 'English', vtt, default: true },
    { id: 'ch', label: 'Chapters', kind: 'chapters', vtt: chaptersVtt },
  ]}
  showTranscript
/>
```

| Control | Behavior |
| --- | --- |
| Captions button | Toggles on-video plain-text cues |
| Track picker | Switches captions/subtitles tracks; Off disables |
| **C** key | Toggles captions (when focus is on the player) |
| Chapter menu | Seeks to chapter start; changes announced via `@texuli/core/announcer` |
| Transcript | Optional cue list with seek |

Remote track `src` values use `safeMediaSrc` with the player's `trust` and
`allowedOrigins`. Cue text is never rendered as HTML.

## Editing trim and captions

`VideoEditPanel` from `@texuli/media/video` edits a serializable `VideoEdit`
recipe. It has accessible start/end time inputs and caption cue fields; use
`validateVideoEdit` before storing untrusted recipes. Caption text stays plain
text, and `serializeWebVtt(cues, trim)` escapes markup characters and rebases
intersecting cues to the trimmed clip's zero point.

```svelte
<script lang="ts">
  import { VideoEditPanel, type VideoEdit } from '@texuli/media/video';
  import { CompositionExport } from '@texuli/media/export/ui';

  let edit: VideoEdit = $state({
    version: 1,
    trim: { startMs: 0, endMs: 4000 },
    captions: [],
  });
</script>

<VideoEditPanel durationMs={4000} value={edit} onchange={(next) => (edit = next)} />
<CompositionExport {composition} {animation} trim={edit.trim} />
```

WebM composition exports accept that source interval through `trim` and expose
it as `sourceRange` in the result. `VideoEditPanel` edits a recipe; it does not
re-encode arbitrary source video. The WebM export renders a validated
composition animation through the existing canvas and browser recorder.
