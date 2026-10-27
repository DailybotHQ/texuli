/**
 * Static copy for /drag-page/: the engine's pieces and the demo sections.
 * Plain data, so the page, the tests and the Markdown twin share one source.
 */

export interface DragPiece {
  readonly name: string;
  readonly role: string;
}

/** The subpaths of @texuli/drag, each one Lego piece. */
export const DRAG_PIECES: readonly DragPiece[] = [
  { name: 'session', role: 'pick up, move, drop, cancel' },
  { name: 'sortable', role: 'lists, groups, trees' },
  { name: 'collision', role: 'where a drop lands' },
  { name: 'modifiers', role: 'axis, bounds, snap' },
  { name: 'gesture', role: 'pointer, threshold, capture' },
  { name: 'auto-scroll', role: 'edges on your frame loop' },
  { name: 'spatial', role: 'canvas, zoom, guides, marquee' },
  { name: 'graph', role: 'ports and edges' },
  { name: 'messages', role: 'localized announcements' },
];

export interface DragSection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly points?: readonly string[];
}

export const DRAG_SECTIONS: readonly DragSection[] = [
  {
    id: 'lists',
    title: 'Lists in every axis',
    summary:
      'Vertical, horizontal and grid lists. In right-to-left text the inline arrows swap; the grid can swap two tiles instead of inserting.',
  },
  {
    id: 'groups',
    title: 'Groups, clones and locked items',
    summary:
      'Lists that share a group exchange items. The palette clones and accepts nothing back; the pinned summary is locked and keeps its place; tick several blocks to move them together.',
  },
  {
    id: 'canvas',
    title: 'Free placement on a canvas',
    summary:
      'The spatial piece: pan, zoom around the pointer, snap to a grid or to other cards with guides, and select with a marquee. Cards move from the keyboard too.',
  },
  {
    id: 'grid-columns',
    title: 'Grid columns',
    summary:
      'The data grid reorders headers inside their pin zone and resizes them on the same engine; each column menu offers the same moves without dragging.',
  },
  {
    id: 'file-drop',
    title: 'File drop: a different interaction kind',
    summary:
      'Dropping files from your computer is not @texuli/drag: the files come from the operating system, so it lives in @texuli/primitives/file-drop. Nothing is uploaded.',
  },
  {
    id: 'contract',
    title: 'The contract every surface keeps',
    summary: '',
    points: [
      'Keyboard: Space or Enter picks up, arrows move, Space or Enter drops, Escape cancels and restores focus.',
      'Announcements go to a polite live region from localized message templates; no surface hardcodes English.',
      'Handles are buttons of at least 24 by 24 pixels with instructions; no aria-grabbed.',
      'Reduced motion turns move animations off; forced colors keep handles, indicators and focus visible.',
      'Rects are measured when a drag starts and again only on scroll, so moving never thrashes layout.',
      'No runtime dependencies, nothing at module load, and nothing rendered as HTML.',
    ],
  },
];
