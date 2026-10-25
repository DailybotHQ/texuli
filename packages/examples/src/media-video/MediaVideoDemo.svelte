<script lang="ts">
import { VideoPlayer } from '@texuli/media/video';
import harborPoster from '../media-image/harbor.svg?url&no-inline';

const poster = harborPoster;
/*
 * The demo's source is app-authored, so it uses the `developer` URL tier,
 * which accepts a same-origin relative path. The `untrusted` tier only takes
 * allowlisted HTTPS origins and would block it, leaving no player. The file is
 * fictional; `preload="none"` means nothing is fetched until Play.
 */
const src = '/media-fixtures/harbor-notes-ferry.webm';

const CAPTIONS_VTT = `WEBVTT

NOTE Fictional Harbor Notes ferry tour

00:00:00.000 --> 00:00:02.500
Welcome aboard the Harbor Notes ferry.

00:00:02.500 --> 00:00:05.000
Watch the lighthouse on your right.

00:00:30.000 --> 00:00:33.000
Open water — the bay is calm this morning.
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

const tracks = [
  { id: 'en', label: 'English', kind: 'captions' as const, vtt: CAPTIONS_VTT, default: true },
  { id: 'chapters', label: 'Chapters', kind: 'chapters' as const, vtt: CHAPTERS_VTT },
];
</script>

<section class="demo" data-example="media-video" aria-labelledby="media-video-title">
  <h2 id="media-video-title">Video player</h2>
  <p>
    Custom controls with captions (toggle or press C), a track picker, chapter seek, and an optional
    transcript. Track URLs use the media URL policy; this demo uses inline WebVTT. Fictional copy.
  </p>
  <VideoPlayer
    {src}
    {poster}
    trust="developer"
    {tracks}
    showTranscript
    title="Boats moving through a harbor"
    playsInline
  />
  <VideoPlayer src="javascript:alert(1)" poster="javascript:alert(1)" title="Blocked video" />
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    max-inline-size: 48rem;
    padding: 1.5rem;
  }
  .demo h2,
  .demo p {
    margin: 0;
  }
</style>
