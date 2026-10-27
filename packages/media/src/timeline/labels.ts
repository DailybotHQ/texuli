/**
 * Every visible or announced string of the animation timeline. `{name}`
 * placeholders are filled in as plain text; times arrive already formatted
 * through `seconds`.
 */
export interface TimelineLabels {
  /** The editor's region name; also titles the preview. */
  title: string;
  /** Preview title: `{title}`, `{time}`. */
  previewTitle: string;
  /** A time in seconds: `{value}` (two decimals). */
  seconds: string;
  loadingPreview: string;
  loadingTimeline: string;
  /** Shown when the editor chunk fails to load. */
  loadFailed: string;
  cannotEdit: string;
  controls: string;
  undo: string;
  redo: string;
  undone: string;
  redone: string;
  playhead: string;
  /** Names the table and its scroll region. */
  table: string;
  layer: string;
  window: string;
  keyframes: string;
  start: string;
  end: string;
  /** `{layer}` */
  startOf: string;
  /** `{layer}` */
  endOf: string;
  clear: string;
  /** `{layer}` */
  clearWindow: string;
  /** `{layer}`, `{start}`, `{end}` */
  windowSet: string;
  /** `{layer}` */
  windowCleared: string;
  staticComposition: string;
  /** `{index}`, `{count}`, `{layer}`, `{time}` */
  keyframe: string;
  addKeyframe: string;
  /** `{layer}`, `{time}` */
  addKeyframeTo: string;
  /** `{layer}`, `{time}` */
  keyframeAdded: string;
  /** `{time}` */
  keyframeMoved: string;
  /** `{time}` */
  keyframeRemoved: string;
  /** Inspector legend: `{time}`, `{layer}` */
  inspector: string;
  easing: string;
  /** `{easing}` */
  easingSet: string;
  opacity: string;
  /** `{value}` */
  opacitySet: string;
  /** `{reason}`: the model's refusal message */
  notApplied: string;
  /** The `{reason}` of `notApplied` when the refusal carries no message. */
  invalidEdit: string;
}

export const DEFAULT_TIMELINE_LABELS: Readonly<TimelineLabels> = Object.freeze({
  title: 'Animation timeline',
  previewTitle: '{title} at {time}',
  seconds: '{value} s',
  loadingPreview: 'Loading preview…',
  loadingTimeline: 'Loading timeline…',
  loadFailed: 'The animation timeline could not be loaded.',
  cannotEdit: 'This animation cannot be edited.',
  controls: 'Timeline controls',
  undo: 'Undo',
  redo: 'Redo',
  undone: 'Undone.',
  redone: 'Redone.',
  playhead: 'Playhead',
  table: 'Layers, windows and keyframes',
  layer: 'Layer',
  window: 'Window',
  keyframes: 'Keyframes',
  start: 'Start',
  end: 'End',
  startOf: 'Start of {layer}',
  endOf: 'End of {layer}',
  clear: 'Clear',
  clearWindow: 'Show {layer} for the whole timeline',
  windowSet: '{layer} shows from {start} to {end}.',
  windowCleared: '{layer} shows for the whole timeline.',
  staticComposition: 'Static composition',
  keyframe: 'Keyframe {index} of {count} on {layer} at {time}',
  addKeyframe: 'Add keyframe',
  addKeyframeTo: 'Add a keyframe to {layer} at {time}',
  keyframeAdded: 'Keyframe added to {layer} at {time}.',
  keyframeMoved: 'Keyframe moved to {time}.',
  keyframeRemoved: 'Keyframe at {time} removed.',
  inspector: 'Keyframe at {time} on {layer}',
  easing: 'Easing into this keyframe',
  easingSet: 'Easing set to {easing}.',
  opacity: 'Opacity',
  opacitySet: 'Opacity set to {value}.',
  notApplied: 'Not applied: {reason}',
  invalidEdit: 'invalid edit',
});

/** Fills `{name}` placeholders as plain text; unknown ones stay as written. */
export function fillTimelineLabel(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match
  );
}

/**
 * The announcement for a refused edit. An empty or missing refusal message
 * falls back to `invalidEdit`, so the status never ends in a bare colon.
 */
export function refusalAnnouncement(
  labels: Pick<TimelineLabels, 'notApplied' | 'invalidEdit'>,
  reason: string | undefined
): string {
  const text = reason?.trim() ? reason : labels.invalidEdit;
  return fillTimelineLabel(labels.notApplied, { reason: text });
}
