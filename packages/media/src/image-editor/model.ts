import type {
  Annotation,
  AnnotationPatch,
  EditAction,
  FilterName,
  ImageEdit,
  ImageEditIssue,
  ImageEditValidation,
  ImageFilters,
  NormalizedRect,
  QuarterTurn,
  SourceSize,
} from './types.ts';

/** Bounds every edit stays inside, whatever its origin. */
export const IMAGE_EDIT_LIMITS = Object.freeze({
  /** Largest output side in pixels. */
  maxDimension: 8192,
  /** Largest output area (Safari's canvas ceiling). */
  maxPixels: 16_777_216,
  /** Smallest crop side, as a fraction of the oriented image. */
  minCrop: 0.01,
  maxAnnotations: 50,
  maxTextLength: 280,
  minStrokeWidth: 0.001,
  maxStrokeWidth: 0.05,
  minFontSize: 0.01,
  maxFontSize: 0.5,
  /** Serialized edit JSON, in UTF-8 bytes. */
  maxSerializedBytes: 64 * 1024,
  maxIssues: 50,
  maxHistory: 100,
});

/** Range and neutral value of each filter, in the order they are applied. */
export const FILTER_RANGES: Readonly<
  Record<FilterName, { min: number; max: number; neutral: number; step: number }>
> = Object.freeze({
  brightness: { min: 0, max: 200, neutral: 100, step: 1 },
  contrast: { min: 0, max: 200, neutral: 100, step: 1 },
  saturation: { min: 0, max: 200, neutral: 100, step: 1 },
  grayscale: { min: 0, max: 100, neutral: 0, step: 1 },
  sepia: { min: 0, max: 100, neutral: 0, step: 1 },
  hueRotate: { min: -180, max: 180, neutral: 0, step: 1 },
  blur: { min: 0, max: 0.05, neutral: 0, step: 0.001 },
});

export const FILTER_NAMES = Object.freeze(Object.keys(FILTER_RANGES) as FilterName[]);

export const NEUTRAL_FILTERS: Readonly<ImageFilters> = Object.freeze(
  Object.fromEntries(FILTER_NAMES.map((name) => [name, FILTER_RANGES[name].neutral]))
) as Readonly<ImageFilters>;

/** Annotation colors offered by the editor (any six-digit hex is valid in data). */
export const ANNOTATION_COLORS = Object.freeze([
  '#e11d48',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#111827',
  '#ffffff',
]);

/** An edit that changes nothing. */
export function createImageEdit(): ImageEdit {
  return {
    version: 1,
    rotate: 0,
    flipX: false,
    flipY: false,
    filters: { ...NEUTRAL_FILTERS },
    annotations: [],
  };
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
// C0 controls and DEL; annotation text is painted with fillText, never parsed.
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are the target
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Clamps a filter amount to its range; a non-number gives the neutral value. */
export function clampFilter(name: FilterName, value: number): number {
  const range = FILTER_RANGES[name];
  return finite(value) ? clamp(value, range.min, range.max) : range.neutral;
}

/** Clamps a rectangle into the unit square, keeping at least the minimum crop size. */
export function clampRect(
  rect: NormalizedRect,
  minSize: number = IMAGE_EDIT_LIMITS.minCrop
): NormalizedRect {
  const width = clamp(finite(rect.width) ? rect.width : 1, minSize, 1);
  const height = clamp(finite(rect.height) ? rect.height : 1, minSize, 1);
  return {
    x: clamp(finite(rect.x) ? rect.x : 0, 0, 1 - width),
    y: clamp(finite(rect.y) ? rect.y : 0, 0, 1 - height),
    width,
    height,
  };
}

const isFullRect = (rect: NormalizedRect) =>
  rect.x <= 1e-9 && rect.y <= 1e-9 && rect.width >= 1 - 1e-9 && rect.height >= 1 - 1e-9;

// ── orientation geometry ──────────────────────────────────────────────────

/** A normalized point rotated a quarter turn clockwise (`1`) or counterclockwise (`-1`). */
export function rotatePoint(point: { x: number; y: number }, turns: -1 | 1) {
  return turns === 1 ? { x: 1 - point.y, y: point.x } : { x: point.y, y: 1 - point.x };
}

/** A normalized rectangle rotated a quarter turn with the image. */
export function rotateRect(rect: NormalizedRect, turns: -1 | 1): NormalizedRect {
  return turns === 1
    ? { x: 1 - rect.y - rect.height, y: rect.x, width: rect.height, height: rect.width }
    : { x: rect.y, y: 1 - rect.x - rect.width, width: rect.height, height: rect.width };
}

/** A normalized rectangle mirrored with the image. */
export function flipRect(rect: NormalizedRect, axis: 'x' | 'y'): NormalizedRect {
  return axis === 'x'
    ? { ...rect, x: 1 - rect.x - rect.width }
    : { ...rect, y: 1 - rect.y - rect.height };
}

function flipPoint(point: { x: number; y: number }, axis: 'x' | 'y') {
  return axis === 'x' ? { x: 1 - point.x, y: point.y } : { x: point.x, y: 1 - point.y };
}

/** The source size after the quarter turns. */
export function orientedSize(source: SourceSize, rotate: QuarterTurn): SourceSize {
  return rotate === 90 || rotate === 270
    ? { width: source.height, height: source.width }
    : { width: source.width, height: source.height };
}

/** The crop in oriented pixels. */
export function cropPixels(edit: ImageEdit, source: SourceSize): NormalizedRect {
  const oriented = orientedSize(source, edit.rotate);
  const crop = edit.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  return {
    x: crop.x * oriented.width,
    y: crop.y * oriented.height,
    width: crop.width * oriented.width,
    height: crop.height * oriented.height,
  };
}

/** Fit a centered crop with the requested pixel aspect ratio inside an existing crop. */
export function cropToAspectRatio(
  rect: NormalizedRect,
  source: SourceSize,
  aspectRatio: number
): NormalizedRect {
  const crop = clampRect(rect);
  if (
    !finite(source.width) ||
    !finite(source.height) ||
    source.width <= 0 ||
    source.height <= 0 ||
    !finite(aspectRatio) ||
    aspectRatio <= 0
  ) {
    return crop;
  }
  const widthPerHeight = (source.height * aspectRatio) / source.width;
  let width = crop.width;
  let height = crop.height;
  if (width / height > widthPerHeight) width = height * widthPerHeight;
  else height = width / widthPerHeight;
  if (width < IMAGE_EDIT_LIMITS.minCrop || height < IMAGE_EDIT_LIMITS.minCrop) return crop;
  return {
    x: crop.x + (crop.width - width) / 2,
    y: crop.y + (crop.height - height) / 2,
    width,
    height,
  };
}

/**
 * The output size in whole pixels: `resize`, or the cropped size, then scaled
 * down (keeping the aspect ratio) to fit {@link IMAGE_EDIT_LIMITS}.
 */
export function outputSize(edit: ImageEdit, source: SourceSize): SourceSize {
  const crop = cropPixels(edit, source);
  let width = edit.resize?.width ?? crop.width;
  let height = edit.resize?.height ?? crop.height;
  const scale = Math.min(
    1,
    IMAGE_EDIT_LIMITS.maxDimension / Math.max(width, height),
    Math.sqrt(IMAGE_EDIT_LIMITS.maxPixels / Math.max(1, width * height))
  );
  width *= scale;
  height *= scale;
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

// ── actions ───────────────────────────────────────────────────────────────

function mapAnnotation(
  annotation: Annotation,
  point: (p: { x: number; y: number }) => { x: number; y: number },
  rect: (r: NormalizedRect) => NormalizedRect
): Annotation {
  switch (annotation.type) {
    case 'rect':
    case 'ellipse':
      return { ...annotation, frame: rect(annotation.frame) };
    case 'arrow':
      return { ...annotation, from: point(annotation.from), to: point(annotation.to) };
    case 'text':
      return { ...annotation, at: point(annotation.at) };
  }
}

function patchAnnotation(annotation: Annotation, patch: AnnotationPatch): Annotation {
  const color =
    patch.color !== undefined && HEX_COLOR.test(patch.color) ? patch.color : annotation.color;
  const strokeWidth =
    patch.strokeWidth !== undefined
      ? clamp(patch.strokeWidth, IMAGE_EDIT_LIMITS.minStrokeWidth, IMAGE_EDIT_LIMITS.maxStrokeWidth)
      : annotation.strokeWidth;
  const base = { ...annotation, color, strokeWidth };
  const point = (p: { x: number; y: number }) => ({ x: clamp01(p.x), y: clamp01(p.y) });
  switch (base.type) {
    case 'rect':
    case 'ellipse':
      return patch.frame ? { ...base, frame: clampRect(patch.frame, 0.005) } : base;
    case 'arrow':
      return {
        ...base,
        from: patch.from ? point(patch.from) : base.from,
        to: patch.to ? point(patch.to) : base.to,
      };
    case 'text': {
      const text =
        patch.text !== undefined && !CONTROL_CHARS.test(patch.text)
          ? patch.text.slice(0, IMAGE_EDIT_LIMITS.maxTextLength)
          : base.text;
      const fontSize =
        patch.fontSize !== undefined
          ? clamp(patch.fontSize, IMAGE_EDIT_LIMITS.minFontSize, IMAGE_EDIT_LIMITS.maxFontSize)
          : base.fontSize;
      return { ...base, text, fontSize, at: patch.at ? point(patch.at) : base.at };
    }
  }
}

function moveAnnotation(annotation: Annotation, dx: number, dy: number): Annotation {
  switch (annotation.type) {
    case 'rect':
    case 'ellipse': {
      const { frame } = annotation;
      return {
        ...annotation,
        frame: {
          ...frame,
          x: clamp(frame.x + dx, 0, 1 - frame.width),
          y: clamp(frame.y + dy, 0, 1 - frame.height),
        },
      };
    }
    case 'arrow': {
      // Move both ends by the same amount, limited so neither leaves the image.
      const xs = [annotation.from.x, annotation.to.x];
      const ys = [annotation.from.y, annotation.to.y];
      const mx = clamp(dx, -Math.min(...xs), 1 - Math.max(...xs));
      const my = clamp(dy, -Math.min(...ys), 1 - Math.max(...ys));
      return {
        ...annotation,
        from: { x: annotation.from.x + mx, y: annotation.from.y + my },
        to: { x: annotation.to.x + mx, y: annotation.to.y + my },
      };
    }
    case 'text':
      return {
        ...annotation,
        at: { x: clamp01(annotation.at.x + dx), y: clamp01(annotation.at.y + dy) },
      };
  }
}

/**
 * Applies one action and returns a new edit; the input is never mutated.
 * Rotations and flips carry the crop and the annotations with the image.
 * Unknown annotation ids leave the edit unchanged.
 */
export function applyEditAction(edit: ImageEdit, action: EditAction): ImageEdit {
  switch (action.type) {
    case 'rotate': {
      // Rotating the shown image: R·F(x)·R(θ) = F(y)·R(θ + 90°), so the flips swap.
      const rotate = (((edit.rotate + action.turns * 90) % 360) + 360) % 360;
      return {
        ...edit,
        rotate: rotate as QuarterTurn,
        flipX: edit.flipY,
        flipY: edit.flipX,
        ...(edit.crop ? { crop: rotateRect(edit.crop, action.turns) } : {}),
        annotations: edit.annotations.map((a) =>
          mapAnnotation(
            a,
            (p) => rotatePoint(p, action.turns),
            (r) => rotateRect(r, action.turns)
          )
        ),
      };
    }
    case 'flip':
      return {
        ...edit,
        flipX: action.axis === 'x' ? !edit.flipX : edit.flipX,
        flipY: action.axis === 'y' ? !edit.flipY : edit.flipY,
        ...(edit.crop ? { crop: flipRect(edit.crop, action.axis) } : {}),
        annotations: edit.annotations.map((a) =>
          mapAnnotation(
            a,
            (p) => flipPoint(p, action.axis),
            (r) => flipRect(r, action.axis)
          )
        ),
      };
    case 'crop': {
      const { crop: _previous, ...rest } = edit;
      if (!action.rect) return rest;
      const rect = clampRect(action.rect);
      return isFullRect(rect) ? rest : { ...rest, crop: rect };
    }
    case 'resize': {
      const { resize: _previous, ...rest } = edit;
      if (!action.size) return rest;
      const width = Math.round(clamp(action.size.width, 1, IMAGE_EDIT_LIMITS.maxDimension));
      const height = Math.round(clamp(action.size.height, 1, IMAGE_EDIT_LIMITS.maxDimension));
      if (!finite(width) || !finite(height)) return rest;
      return { ...rest, resize: { width, height } };
    }
    case 'filter':
      return {
        ...edit,
        filters: { ...edit.filters, [action.name]: clampFilter(action.name, action.value) },
      };
    case 'reset-filters':
      return { ...edit, filters: { ...NEUTRAL_FILTERS } };
    case 'add-annotation': {
      if (edit.annotations.length >= IMAGE_EDIT_LIMITS.maxAnnotations) return edit;
      if (edit.annotations.some((a) => a.id === action.annotation.id)) return edit;
      const checked = validateAnnotation(action.annotation, '', []);
      return checked ? { ...edit, annotations: [...edit.annotations, checked] } : edit;
    }
    case 'update-annotation':
      return {
        ...edit,
        annotations: edit.annotations.map((a) =>
          a.id === action.id ? patchAnnotation(a, action.patch) : a
        ),
      };
    case 'move-annotation':
      if (!finite(action.dx) || !finite(action.dy)) return edit;
      return {
        ...edit,
        annotations: edit.annotations.map((a) =>
          a.id === action.id ? moveAnnotation(a, action.dx, action.dy) : a
        ),
      };
    case 'remove-annotation':
      return { ...edit, annotations: edit.annotations.filter((a) => a.id !== action.id) };
    case 'reset':
      return createImageEdit();
  }
}

/** Whether the edit changes nothing (it renders the source as is). */
export function isNeutralEdit(edit: ImageEdit): boolean {
  return (
    edit.rotate === 0 &&
    !edit.flipX &&
    !edit.flipY &&
    !edit.crop &&
    !edit.resize &&
    edit.annotations.length === 0 &&
    FILTER_NAMES.every((name) => edit.filters[name] === FILTER_RANGES[name].neutral)
  );
}

// ── history ───────────────────────────────────────────────────────────────

export interface EditHistory {
  past: readonly ImageEdit[];
  present: ImageEdit;
  future: readonly ImageEdit[];
  /** Consecutive actions with the same key replace one history entry (slider drags). */
  lastKey: string | null;
}

export type HistoryAction =
  | { type: 'apply'; action: EditAction }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace'; edit: ImageEdit };

export function createEditHistory(present: ImageEdit = createImageEdit()): EditHistory {
  return { past: [], present, future: [], lastKey: null };
}

/** The key that lets repeated actions merge into one undo step. */
function coalesceKey(action: EditAction): string | null {
  if (action.type === 'filter') return `filter:${action.name}`;
  if (action.type === 'resize') return 'resize';
  if (action.type === 'crop') return 'crop';
  if (action.type === 'move-annotation') return `move:${action.id}`;
  if (action.type === 'update-annotation') {
    return `update:${action.id}:${Object.keys(action.patch).sort().join(',')}`;
  }
  return null;
}

/** Undo and redo over edits. An action that changes nothing is not recorded. */
export function editHistoryReducer(history: EditHistory, action: HistoryAction): EditHistory {
  switch (action.type) {
    case 'apply': {
      const next = applyEditAction(history.present, action.action);
      if (JSON.stringify(next) === JSON.stringify(history.present)) return history;
      const key = coalesceKey(action.action);
      if (key !== null && key === history.lastKey) {
        return { ...history, present: next, future: [] };
      }
      const past = [...history.past, history.present].slice(-IMAGE_EDIT_LIMITS.maxHistory);
      return { past, present: next, future: [], lastKey: key };
    }
    case 'undo': {
      const previous = history.past.at(-1);
      if (!previous) return history;
      return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
        lastKey: null,
      };
    }
    case 'redo': {
      const [next, ...future] = history.future;
      if (!next) return history;
      return { past: [...history.past, history.present], present: next, future, lastKey: null };
    }
    case 'replace':
      return createEditHistory(action.edit);
  }
}

// ── filters ───────────────────────────────────────────────────────────────

const fmt = (value: number) => String(Math.round(value * 1000) / 1000);

/**
 * The CSS `filter` value for an edit, built from validated numbers only (no
 * caller string reaches it). `blurPx` is the blur radius in output pixels.
 * Neutral filters are left out; a fully neutral set gives `none`.
 */
export function cssFilter(filters: ImageFilters, outputShortSide: number): string {
  const parts: string[] = [];
  const f = Object.fromEntries(
    FILTER_NAMES.map((name) => [name, clampFilter(name, filters[name])])
  ) as unknown as ImageFilters;
  if (f.brightness !== 100) parts.push(`brightness(${fmt(f.brightness)}%)`);
  if (f.contrast !== 100) parts.push(`contrast(${fmt(f.contrast)}%)`);
  if (f.saturation !== 100) parts.push(`saturate(${fmt(f.saturation)}%)`);
  if (f.grayscale !== 0) parts.push(`grayscale(${fmt(f.grayscale)}%)`);
  if (f.sepia !== 0) parts.push(`sepia(${fmt(f.sepia)}%)`);
  if (f.hueRotate !== 0) parts.push(`hue-rotate(${fmt(f.hueRotate)}deg)`);
  const blurPx = f.blur * Math.max(0, outputShortSide);
  if (blurPx > 0) parts.push(`blur(${fmt(blurPx)}px)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}

/** A 3×4 row-major color matrix (RGB rows, last column is the 0–255 offset). */
// biome-ignore format: a 3×4 matrix reads best as rows
export type ColorMatrix = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

const IDENTITY: ColorMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

function multiply(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  // Applies b, then a: (a · b).
  const out: number[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = col === 3 ? (a[row * 4 + 3] as number) : 0;
      for (let k = 0; k < 3; k++) sum += (a[row * 4 + k] as number) * (b[k * 4 + col] as number);
      out.push(sum);
    }
  }
  return out as unknown as ColorMatrix;
}

// biome-ignore format: a 3×4 matrix reads best as rows
const linear = (scale: number, offset: number): ColorMatrix => [
  scale, 0, 0, offset, 0, scale, 0, offset, 0, 0, scale, offset,
];

/**
 * The color part of the filters as one matrix, matching the CSS Filter
 * Effects definitions of brightness, contrast, saturate, grayscale, sepia and
 * hue-rotate, applied in that order. Used where `ctx.filter` is unavailable.
 */
export function filterColorMatrix(filters: ImageFilters): ColorMatrix {
  const b = clampFilter('brightness', filters.brightness) / 100;
  const c = clampFilter('contrast', filters.contrast) / 100;
  const s = clampFilter('saturation', filters.saturation) / 100;
  const g = clampFilter('grayscale', filters.grayscale) / 100;
  const p = clampFilter('sepia', filters.sepia) / 100;
  const h = (clampFilter('hueRotate', filters.hueRotate) * Math.PI) / 180;
  // biome-ignore format: a 3×4 matrix reads best as rows
  const saturate = (amount: number): ColorMatrix => [
    0.213 + 0.787 * amount, 0.715 - 0.715 * amount, 0.072 - 0.072 * amount, 0,
    0.213 - 0.213 * amount, 0.715 + 0.285 * amount, 0.072 - 0.072 * amount, 0,
    0.213 - 0.213 * amount, 0.715 - 0.715 * amount, 0.072 + 0.928 * amount, 0,
  ];
  const q = 1 - g;
  // biome-ignore format: a 3×4 matrix reads best as rows
  const grayscale: ColorMatrix = [
    0.2126 + 0.7874 * q, 0.7152 - 0.7152 * q, 0.0722 - 0.0722 * q, 0,
    0.2126 - 0.2126 * q, 0.7152 + 0.2848 * q, 0.0722 - 0.0722 * q, 0,
    0.2126 - 0.2126 * q, 0.7152 - 0.7152 * q, 0.0722 + 0.9278 * q, 0,
  ];
  const r = 1 - p;
  // biome-ignore format: a 3×4 matrix reads best as rows
  const sepia: ColorMatrix = [
    0.393 + 0.607 * r, 0.769 - 0.769 * r, 0.189 - 0.189 * r, 0,
    0.349 - 0.349 * r, 0.686 + 0.314 * r, 0.168 - 0.168 * r, 0,
    0.272 - 0.272 * r, 0.534 - 0.534 * r, 0.131 + 0.869 * r, 0,
  ];
  const cos = Math.cos(h);
  const sin = Math.sin(h);
  // biome-ignore format: a 3×4 matrix reads best as rows
  const hue: ColorMatrix = [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928, 0,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283, 0,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072, 0,
  ];
  let m = IDENTITY;
  for (const step of [
    linear(b, 0),
    linear(c, (0.5 - 0.5 * c) * 255),
    saturate(s),
    grayscale,
    sepia,
    hue,
  ]) {
    m = multiply(step, m);
  }
  return m;
}

/** Applies a color matrix to RGBA pixels in place (alpha untouched), clamping to 0–255. */
export function applyColorMatrix(data: Uint8ClampedArray, matrix: ColorMatrix): void {
  const [a, b, c, d, e, f, g, h, i, j, k, l] = matrix;
  for (let at = 0; at < data.length; at += 4) {
    const r = data[at] as number;
    const gr = data[at + 1] as number;
    const bl = data[at + 2] as number;
    data[at] = a * r + b * gr + c * bl + d;
    data[at + 1] = e * r + f * gr + g * bl + h;
    data[at + 2] = i * r + j * gr + k * bl + l;
  }
}

/**
 * Approximates a Gaussian blur of standard deviation `radius` (CSS `blur()`)
 * with three box-blur passes per axis, on RGBA pixels in place.
 */
export function boxBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): void {
  if (!(radius > 0) || width < 1 || height < 1) return;
  // Box sizes for three passes (W3C/Kovesi approximation of a Gaussian).
  const ideal = Math.sqrt((12 * radius * radius) / 3 + 1);
  let lower = Math.floor(ideal);
  if (lower % 2 === 0) lower -= 1;
  const upper = lower + 2;
  const m = Math.round(
    (12 * radius * radius - 3 * lower * lower - 12 * lower - 9) / (-4 * lower - 4)
  );
  const sizes = [0, 1, 2].map((pass) => (pass < m ? lower : upper));
  const buffer = new Float32Array(data.length);
  for (const size of sizes) {
    const half = Math.max(0, (size - 1) / 2);
    if (half === 0) continue;
    blurPass(data, buffer, width, height, half, true);
    blurPass(data, buffer, width, height, half, false);
  }
}

function blurPass(
  data: Uint8ClampedArray,
  buffer: Float32Array,
  width: number,
  height: number,
  half: number,
  horizontal: boolean
): void {
  const lines = horizontal ? height : width;
  const length = horizontal ? width : height;
  const index = (line: number, pos: number) =>
    (horizontal ? line * width + pos : pos * width + line) * 4;
  const span = 2 * half + 1;
  for (let line = 0; line < lines; line++) {
    for (let channel = 0; channel < 4; channel++) {
      let sum = 0;
      for (let pos = -half; pos <= half; pos++) {
        sum += data[index(line, clamp(pos, 0, length - 1)) + channel] as number;
      }
      for (let pos = 0; pos < length; pos++) {
        buffer[index(line, pos) + channel] = sum / span;
        const out = data[index(line, clamp(pos - half, 0, length - 1)) + channel] as number;
        const into = data[index(line, clamp(pos + half + 1, 0, length - 1)) + channel] as number;
        sum += into - out;
      }
    }
    for (let pos = 0; pos < length; pos++) {
      const at = index(line, pos);
      for (let channel = 0; channel < 4; channel++)
        data[at + channel] = buffer[at + channel] as number;
    }
  }
}

// ── validation (untrusted edit JSON) ──────────────────────────────────────

type Issues = ImageEditIssue[];

function issue(errors: Issues, path: string, code: ImageEditIssue['code'], message: string): void {
  if (errors.length < IMAGE_EDIT_LIMITS.maxIssues) errors.push({ path, code, message });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function onlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  errors: Issues
): void {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) issue(errors, `${path}.${key}`, 'unknown-field', 'Unknown field.');
  }
}

function number(
  value: unknown,
  path: string,
  min: number,
  max: number,
  errors: Issues
): number | undefined {
  if (!finite(value) || value < min || value > max) {
    issue(errors, path, 'invalid-value', `Expected a number from ${min} to ${max}.`);
    return undefined;
  }
  return value;
}

function point(value: unknown, path: string, errors: Issues): { x: number; y: number } | undefined {
  if (!isRecord(value)) {
    issue(errors, path, 'invalid-value', 'Expected a point { x, y }.');
    return undefined;
  }
  onlyKeys(value, ['x', 'y'], path, errors);
  const x = number(value.x, `${path}.x`, 0, 1, errors);
  const y = number(value.y, `${path}.y`, 0, 1, errors);
  return x === undefined || y === undefined ? undefined : { x, y };
}

function rect(
  value: unknown,
  path: string,
  minSize: number,
  errors: Issues
): NormalizedRect | undefined {
  if (!isRecord(value)) {
    issue(errors, path, 'invalid-value', 'Expected a rectangle { x, y, width, height }.');
    return undefined;
  }
  onlyKeys(value, ['x', 'y', 'width', 'height'], path, errors);
  const x = number(value.x, `${path}.x`, 0, 1, errors);
  const y = number(value.y, `${path}.y`, 0, 1, errors);
  const width = number(value.width, `${path}.width`, minSize, 1, errors);
  const height = number(value.height, `${path}.height`, minSize, 1, errors);
  if (x === undefined || y === undefined || width === undefined || height === undefined)
    return undefined;
  if (x + width > 1 + 1e-9 || y + height > 1 + 1e-9) {
    issue(errors, path, 'invalid-value', 'The rectangle must stay inside the image.');
    return undefined;
  }
  return { x, y, width, height };
}

function validateAnnotation(value: unknown, path: string, errors: Issues): Annotation | undefined {
  if (!isRecord(value)) {
    issue(errors, path, 'invalid-value', 'Expected an annotation object.');
    return undefined;
  }
  const { id, type, color, strokeWidth } = value;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    issue(
      errors,
      `${path}.id`,
      'invalid-value',
      'Use 1–64 letters, digits, hyphens or underscores.'
    );
  }
  if (typeof color !== 'string' || !HEX_COLOR.test(color)) {
    issue(errors, `${path}.color`, 'invalid-value', 'Use a six-digit hex color.');
  }
  const stroke = number(
    strokeWidth,
    `${path}.strokeWidth`,
    IMAGE_EDIT_LIMITS.minStrokeWidth,
    IMAGE_EDIT_LIMITS.maxStrokeWidth,
    errors
  );
  const base =
    typeof id === 'string' &&
    ID_PATTERN.test(id) &&
    typeof color === 'string' &&
    HEX_COLOR.test(color) &&
    stroke !== undefined
      ? { id, color, strokeWidth: stroke }
      : undefined;
  switch (type) {
    case 'rect':
    case 'ellipse': {
      onlyKeys(value, ['id', 'type', 'color', 'strokeWidth', 'frame'], path, errors);
      const frame = rect(value.frame, `${path}.frame`, 0.005, errors);
      return base && frame ? { ...base, type, frame } : undefined;
    }
    case 'arrow': {
      onlyKeys(value, ['id', 'type', 'color', 'strokeWidth', 'from', 'to'], path, errors);
      const from = point(value.from, `${path}.from`, errors);
      const to = point(value.to, `${path}.to`, errors);
      return base && from && to ? { ...base, type, from, to } : undefined;
    }
    case 'text': {
      onlyKeys(
        value,
        ['id', 'type', 'color', 'strokeWidth', 'at', 'text', 'fontSize'],
        path,
        errors
      );
      const at = point(value.at, `${path}.at`, errors);
      const { text } = value;
      let ok = true;
      if (
        typeof text !== 'string' ||
        text.trim().length === 0 ||
        text.length > IMAGE_EDIT_LIMITS.maxTextLength ||
        CONTROL_CHARS.test(text)
      ) {
        issue(
          errors,
          `${path}.text`,
          'invalid-value',
          `Use 1–${IMAGE_EDIT_LIMITS.maxTextLength} characters without control characters.`
        );
        ok = false;
      }
      const fontSize = number(
        value.fontSize,
        `${path}.fontSize`,
        IMAGE_EDIT_LIMITS.minFontSize,
        IMAGE_EDIT_LIMITS.maxFontSize,
        errors
      );
      return base && at && ok && fontSize !== undefined && typeof text === 'string'
        ? { ...base, type, at, text, fontSize }
        : undefined;
    }
    default:
      issue(errors, `${path}.type`, 'invalid-value', 'Use rect, ellipse, arrow or text.');
      return undefined;
  }
}

const utf8Length = (text: string) => new TextEncoder().encode(text).byteLength;

/**
 * Validates an edit from any origin (a file, storage, an agent). Never throws.
 * Every field is checked and bounded; unknown fields, non-finite numbers,
 * out-of-range values, unsafe text and oversized input are refused, and a
 * refused edit is never applied in part.
 */
export function validateImageEdit(input: unknown): ImageEditValidation {
  const errors: Issues = [];
  let serialized: string;
  try {
    serialized = typeof input === 'string' ? input : (JSON.stringify(input) ?? '');
  } catch {
    return {
      ok: false,
      errors: [{ path: '$', code: 'invalid-input', message: 'Not serializable.' }],
    };
  }
  if (utf8Length(serialized) > IMAGE_EDIT_LIMITS.maxSerializedBytes) {
    return {
      ok: false,
      errors: [
        {
          path: '$',
          code: 'limit-exceeded',
          message: `An edit must be at most ${IMAGE_EDIT_LIMITS.maxSerializedBytes} bytes.`,
        },
      ],
    };
  }
  let value: unknown = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch {
      return {
        ok: false,
        errors: [{ path: '$', code: 'invalid-input', message: 'Not valid JSON.' }],
      };
    }
  }
  if (!isRecord(value)) {
    return {
      ok: false,
      errors: [{ path: '$', code: 'invalid-input', message: 'Expected an object.' }],
    };
  }
  onlyKeys(
    value,
    ['version', 'rotate', 'flipX', 'flipY', 'crop', 'resize', 'filters', 'annotations'],
    '$',
    errors
  );
  if (value.version !== 1) issue(errors, '$.version', 'invalid-value', 'Expected version 1.');
  const rotate = value.rotate ?? 0;
  if (rotate !== 0 && rotate !== 90 && rotate !== 180 && rotate !== 270) {
    issue(errors, '$.rotate', 'invalid-value', 'Use 0, 90, 180 or 270.');
  }
  for (const key of ['flipX', 'flipY'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      issue(errors, `$.${key}`, 'invalid-value', 'Expected true or false.');
    }
  }
  const crop =
    value.crop === undefined
      ? undefined
      : rect(value.crop, '$.crop', IMAGE_EDIT_LIMITS.minCrop, errors);
  let resize: { width: number; height: number } | undefined;
  if (value.resize !== undefined) {
    if (!isRecord(value.resize)) {
      issue(errors, '$.resize', 'invalid-value', 'Expected { width, height }.');
    } else {
      onlyKeys(value.resize, ['width', 'height'], '$.resize', errors);
      const width = number(
        value.resize.width,
        '$.resize.width',
        1,
        IMAGE_EDIT_LIMITS.maxDimension,
        errors
      );
      const height = number(
        value.resize.height,
        '$.resize.height',
        1,
        IMAGE_EDIT_LIMITS.maxDimension,
        errors
      );
      if (width !== undefined && height !== undefined) {
        if (!Number.isInteger(width) || !Number.isInteger(height)) {
          issue(errors, '$.resize', 'invalid-value', 'Use whole pixels.');
        } else if (width * height > IMAGE_EDIT_LIMITS.maxPixels) {
          issue(
            errors,
            '$.resize',
            'limit-exceeded',
            `At most ${IMAGE_EDIT_LIMITS.maxPixels} pixels.`
          );
        } else {
          resize = { width, height };
        }
      }
    }
  }
  const filters: ImageFilters = { ...NEUTRAL_FILTERS };
  if (value.filters !== undefined) {
    if (!isRecord(value.filters)) {
      issue(errors, '$.filters', 'invalid-value', 'Expected an object of filter amounts.');
    } else {
      onlyKeys(value.filters, FILTER_NAMES, '$.filters', errors);
      for (const name of FILTER_NAMES) {
        const raw = value.filters[name];
        if (raw === undefined) continue;
        const range = FILTER_RANGES[name];
        const amount = number(raw, `$.filters.${name}`, range.min, range.max, errors);
        if (amount !== undefined) filters[name] = amount;
      }
    }
  }
  const annotations: Annotation[] = [];
  if (value.annotations !== undefined) {
    if (!Array.isArray(value.annotations)) {
      issue(errors, '$.annotations', 'invalid-value', 'Expected an array.');
    } else if (value.annotations.length > IMAGE_EDIT_LIMITS.maxAnnotations) {
      issue(
        errors,
        '$.annotations',
        'limit-exceeded',
        `At most ${IMAGE_EDIT_LIMITS.maxAnnotations} annotations.`
      );
    } else {
      const seen = new Set<string>();
      value.annotations.forEach((raw: unknown, index: number) => {
        const checked = validateAnnotation(raw, `$.annotations[${index}]`, errors);
        if (!checked) return;
        if (seen.has(checked.id)) {
          issue(
            errors,
            `$.annotations[${index}].id`,
            'duplicate-id',
            'Annotation ids must be unique.'
          );
          return;
        }
        seen.add(checked.id);
        annotations.push(checked);
      });
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    edit: {
      version: 1,
      rotate: rotate as QuarterTurn,
      flipX: value.flipX === true,
      flipY: value.flipY === true,
      ...(crop && !isFullRect(crop) ? { crop } : {}),
      ...(resize ? { resize } : {}),
      filters,
      annotations,
    },
  };
}
