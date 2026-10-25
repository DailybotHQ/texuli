/**
 * `@texuli/media/audio` — audio player and waveform.
 */

export { default as AudioPlayer } from './AudioPlayer.svelte';
export {
  AUDIO_LIMITS,
  type AudioTrust,
  buildWaveformPeaks,
  clampSeekRatio,
  type DecodeWaveformOptions,
  decodeWaveformPeaks,
  formatAudioTime,
  monoFromAudioBuffer,
  type ResolveAudioSourceInput,
  type ResolvedAudioSource,
  resolveAudioSource,
} from './model.ts';
export type {
  AudioPlayerLabels,
  AudioPlayerProps,
  WaveformProps,
} from './types.ts';
export { default as Waveform } from './Waveform.svelte';
