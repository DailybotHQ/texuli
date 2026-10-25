/**
 * The player's announcements model: one place decides what assistive
 * technology hears, how urgently, and when to stay quiet.
 *
 * Channels:
 * - `assertive` is reserved for validation refusals. Its region is the
 *   visible notice (`role="alert"`), which interrupts.
 * - `polite` carries everything else through one `aria-live="polite"`
 *   region: the paint result, unresolved placeholders, the preview warning,
 *   host status changes and the selection.
 *
 * No other player element is a live region, so nothing is spoken twice.
 * A message is announced only when its text changes on its channel
 * (`dedupe`): repaints, state updates and repeated selections that change
 * nothing say nothing.
 */

export type Politeness = 'polite' | 'assertive';

export interface Announcement {
  politeness: Politeness;
  text: string;
}

/** Fill `{name}` slots in a localized template. Unknown slots stay as written. */
export function formatAnnouncement(
  template: string,
  values: Readonly<Record<string, string | number>>
): string {
  return template.replace(/\{(\w+)\}/g, (slot, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : slot
  );
}

/** What a settled paint looks like, for the polite lifecycle message. */
export interface PaintSummary {
  /** Content-layout frames painted. */
  frames: number;
  /** Nodes painted as placeholders (unknown id, no painter, a failed load or mount). */
  placeholders: number;
  /** An invalid draft painted with `invalidPolicy="preview"`. */
  preview: boolean;
  /** The host status text, when it is not the default draft. */
  status: string | null;
}

export interface AnnouncementLabels {
  painted: string;
  placeholdersUnresolved: string;
  previewWarning: string;
  statusChanged: string;
  selected: string;
  selectedOne: string;
}

/** The polite message for a settled paint, built from localized templates. */
export function paintAnnouncement(summary: PaintSummary, labels: AnnouncementLabels): string {
  const parts = [formatAnnouncement(labels.painted, { frames: summary.frames })];
  if (summary.placeholders > 0) {
    parts.push(formatAnnouncement(labels.placeholdersUnresolved, { count: summary.placeholders }));
  }
  if (summary.preview) parts.push(labels.previewWarning);
  if (summary.status)
    parts.push(formatAnnouncement(labels.statusChanged, { status: summary.status }));
  return parts.join(' ');
}

/**
 * The polite message for a selection change: the frame's name for one, the
 * count for several, nothing for none. `selected` may omit `{count}`, in
 * which case the count leads (the label's original form, "2 selected").
 */
export function selectionAnnouncement(
  names: readonly string[],
  labels: AnnouncementLabels
): string {
  if (names.length === 0) return '';
  if (names.length === 1 && names[0]) {
    return formatAnnouncement(labels.selectedOne, { name: names[0] });
  }
  return labels.selected.includes('{count}')
    ? formatAnnouncement(labels.selected, { count: names.length })
    : `${names.length} ${labels.selected}`;
}

/**
 * Per-channel dedupe: `announce` returns the text to put in the region, or
 * `null` when the same text was the last one on that channel.
 */
export function createAnnouncer() {
  const last = new Map<Politeness, string>();
  return {
    announce(next: Announcement): string | null {
      if (next.text === '' || last.get(next.politeness) === next.text) return null;
      last.set(next.politeness, next.text);
      return next.text;
    },
    /** Forget a channel, so its next message is spoken even if it repeats. */
    reset(politeness: Politeness): void {
      last.delete(politeness);
    },
  };
}
