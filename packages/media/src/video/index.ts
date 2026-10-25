/** Framework-free helpers for the lazy `@texuli/media/video` player. */
export {
  createVideoEdit,
  serializeWebVtt,
  VIDEO_EDIT_LIMITS,
  type VideoEdit,
  type VideoEditIssue,
  type VideoEditValidation,
  type VideoTrimRange,
  validateVideoEdit,
} from './edit.ts';
export {
  formatVideoTime,
  normalizePlaybackRate,
  pickDefaultTextTrack,
  type ResolvedVideoSources,
  type ResolvedVideoTextTrack,
  resolveVideoSources,
  resolveVideoTextTracks,
  VIDEO_PLAYBACK_RATES,
  VIDEO_SOURCE_LIMITS,
  type VideoSourceInput,
  type VideoSourceIssue,
  type VideoTextTrackInput,
  type VideoTextTrackKind,
  type VideoTrust,
} from './model.ts';
export type { VideoPlayerLabels, VideoPlayerProps } from './types.ts';
