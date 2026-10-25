<script lang="ts">
import { CaptionsPanel, chaptersFromCues, parseWebVtt } from '@texuli/media/captions';

/**
 * Captions example: inline WebVTT (deterministic), chapter markers, transcript
 * seek, and a blocked javascript: track. Fictional harbor tour copy only.
 */

const CAPTIONS_VTT = `WEBVTT

NOTE Fictional Harbor Notes ferry tour

00:00:00.000 --> 00:00:02.500
Welcome aboard the Harbor Notes ferry.

00:00:02.500 --> 00:00:05.000
Watch the lighthouse on your right.

00:00:05.000 --> 00:00:08.000
Please keep aisles clear while we cast off.

00:00:30.000 --> 00:00:33.000
Open water — the bay is calm this morning.

00:01:00.000 --> 00:01:03.000
The lighthouse marks the harbor mouth.
`;

const CHAPTERS_VTT = `WEBVTT

Chapter 1
00:00:00.000 --> 00:00:00.000
Departure

Chapter 2
00:00:30.000 --> 00:00:30.000
Open water

Chapter 3
00:01:00.000 --> 00:01:00.000
Lighthouse
`;

const chapters = chaptersFromCues(parseWebVtt(CHAPTERS_VTT, { keepEmpty: true }));
let time = $state(1);
</script>

<article class="demo" data-example="media-captions" aria-labelledby="media-captions-title">
  <h2 id="media-captions-title">Captions and chapters</h2>
  <p>
    Inline WebVTT is parsed to plain text (tags stripped). Chapters and the transcript seek by
    updating the demo clock. No network track is required.
  </p>

  <label class="clock">
    <span>Demo time (seconds)</span>
    <input
      type="range"
      min="0"
      max="70"
      step="0.5"
      bind:value={time}
      aria-valuetext={`${time} seconds`}
    />
    <span data-demo-time>{time.toFixed(1)}s</span>
  </label>

  <section aria-labelledby="panel-title">
    <h3 id="panel-title">Captions panel</h3>
    <CaptionsPanel
      vtt={CAPTIONS_VTT}
      {chapters}
      currentTime={time}
      label="Harbor Notes captions"
      onSeek={(t) => (time = t)}
    />
  </section>

  <section aria-labelledby="blocked-title">
    <h3 id="blocked-title">Blocked unsafe track</h3>
    <CaptionsPanel src="javascript:alert(1)" label="Blocked captions track" />
  </section>
</article>

<style>
  .demo {
    display: grid;
    gap: 1.25rem;
    max-inline-size: 36rem;
    padding: 1.5rem;
  }

  .demo h2,
  .demo h3,
  .demo p {
    margin: 0;
  }

  .clock {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.35rem 0.75rem;
    align-items: center;
    font-size: 0.875rem;
  }

  .clock span:first-child {
    grid-column: 1 / -1;
  }

  .clock input {
    inline-size: 100%;
  }
</style>
