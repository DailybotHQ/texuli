import {
  categoryOf,
  type FileCategory,
  type FileEntry,
  formatSize,
} from '../engines/files/model.ts';
import { thumbnailUrl } from '../engines/files/thumbnail.ts';

export type FileBrowserLayout = 'grid' | 'list';

export interface FilePreviewModel {
  id: string;
  name: string;
  kind: FileEntry['kind'];
  category: FileCategory;
  sizeLabel: string;
  updatedAt?: string;
  /** Safe `src` for the preview image (generated SVG or host-provided). */
  imageSrc: string | undefined;
  type?: string;
}

/** Build the side-panel preview model for one entry. */
export function previewOf(
  entry: FileEntry,
  options: {
    /** Optional host preview URL (already filtered by the URL policy). */
    previewSrc?: string | undefined;
    thumbnailSize?: number;
  } = {}
): FilePreviewModel {
  return {
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    category: categoryOf(entry),
    sizeLabel: entry.kind === 'file' ? formatSize(entry.size) : '',
    ...(entry.updatedAt !== undefined ? { updatedAt: entry.updatedAt } : {}),
    imageSrc: options.previewSrc ?? thumbnailUrl(entry, { size: options.thumbnailSize ?? 160 }),
    ...(entry.type !== undefined ? { type: entry.type } : {}),
  };
}

/**
 * Next focused index in a grid with `columns` per row, given a key and the
 * current index. Returns the same index when the move is out of range.
 */
export function moveFocusIndex(
  index: number,
  count: number,
  columns: number,
  key: string,
  rtl: boolean
): number {
  if (count <= 0) return 0;
  const cols = Math.max(1, Math.floor(columns) || 1);
  const at = Math.max(0, Math.min(index, count - 1));
  const row = Math.floor(at / cols);
  const col = at % cols;
  const lastRow = Math.floor((count - 1) / cols);

  const left = rtl ? 1 : -1;
  const right = rtl ? -1 : 1;

  if (key === 'ArrowLeft') {
    const nextCol = col + left;
    if (nextCol < 0 || nextCol >= cols) return at;
    const next = row * cols + nextCol;
    return next < count ? next : at;
  }
  if (key === 'ArrowRight') {
    const nextCol = col + right;
    if (nextCol < 0 || nextCol >= cols) return at;
    const next = row * cols + nextCol;
    return next < count ? next : at;
  }
  if (key === 'ArrowUp') {
    if (row === 0) return at;
    return (row - 1) * cols + col;
  }
  if (key === 'ArrowDown') {
    if (row >= lastRow) return at;
    const next = (row + 1) * cols + col;
    return next < count ? next : at;
  }
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return at;
}

/** Toggle `id` in a selection list; returns a new array. */
export function toggleSelectedId(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id];
}
