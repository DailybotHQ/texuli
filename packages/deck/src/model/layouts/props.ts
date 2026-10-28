/**
 * The props schemas of the 20 catalog layouts (model-v2 §3.3), ported from
 * Protoyard's `layouts/props.ts` onto the owned schema kit.
 *
 * Every object is strict. Step fields (`step`, `fragment`, `reveal`, `tone`)
 * are declared only on the objects the layout reveals (its steppable paths),
 * so a marker anywhere else is an `unknown-key` issue. Single-line fields are
 * trimmed and refuse control and bidi-override characters; lengths count
 * Unicode code points. Media and link fields check syntax only: the stage
 * applies the URL policy at the host's tier when it paints.
 */
import { t, validate } from '../../schema/index.ts';
import { LINK_HREF_PATTERN, line, MEDIA_SRC_PATTERN, stepFields } from '../shared.ts';

/** The step fields spread onto a steppable props object. */
const steps = stepFields;

/** A required single-line field of 1 to `max` code points. */
const short = (max: number) => line(max, 1);
/** An optional single-line field; when present it is 1 to `max` code points. */
const optionalShort = (max: number) => t.optional(line(max, 1));

const dimension = t.optional(t.int({ min: 1, max: 4_096 }));

/** Media syntax capped at 512 code points (Protoyard's layout limit). */
const layoutMediaSrc = t.string({
  min: 1,
  max: 512,
  pattern: MEDIA_SRC_PATTERN,
  trim: true,
  text: 'line',
  description: 'An https: URL, a relative path, a base64 data: raster or video, or an avatar: id.',
});

/** Link syntax capped at 512 code points. */
const layoutHref = t.string({
  min: 1,
  max: 512,
  pattern: LINK_HREF_PATTERN,
  trim: true,
  text: 'line',
  description: 'An https: or mailto: URL, a #fragment or a relative path.',
});

/** An image placed by a layout; lint asks for a non-empty `alt` and both dimensions. */
const image = t.object({
  ...steps,
  src: layoutMediaSrc,
  alt: line(300),
  width: dimension,
  height: dimension,
});

/** A video placed by a layout. */
const video = t.object({
  ...steps,
  src: layoutMediaSrc,
  label: optionalShort(160),
  width: dimension,
  height: dimension,
  autoplay: t.optional(t.boolean()),
  loop: t.optional(t.boolean()),
  muted: t.optional(t.boolean()),
});

/** Every catalog layout has an optional slide title of at most 120 code points. */
const title = optionalShort(120);

export const titleHeroProps = t.object({
  ...steps,
  title: short(100),
  subtitle: optionalShort(160),
  meta: optionalShort(160),
});

export const sectionDividerProps = t.object({
  ...steps,
  eyebrow: optionalShort(80),
  title: short(120),
});

const column = t.object({ ...steps, heading: optionalShort(80), body: short(600) });

export const twoColumnSplitProps = t.object({
  ...steps,
  title,
  left: column,
  right: column,
});

export const threeColumnCardsProps = t.object({
  ...steps,
  title,
  cards: t.array(
    t.object({
      ...steps,
      /** A Texuli icon name; the stage draws no icon (and lint warns) for an unknown one. */
      icon: optionalShort(40),
      heading: short(80),
      body: short(280),
    }),
    { min: 3, max: 3 }
  ),
});

/** `image-left` and `image-right` share one shape. */
export const imageSideProps = t.object({
  ...steps,
  title,
  image,
  heading: optionalShort(80),
  body: short(600),
});

export const imageCenteredProps = t.object({
  ...steps,
  title,
  image,
  caption: optionalShort(200),
});

export const IMAGE_OVERLAYS = ['none', 'dark', 'light'] as const;

export const imageFullBleedProps = t.object({
  ...steps,
  image,
  caption: optionalShort(200),
  credit: optionalShort(160),
  overlay: t.optional(t.enum(IMAGE_OVERLAYS)),
});

export const quoteProps = t.object({
  ...steps,
  quote: short(280),
  cite: optionalShort(120),
});

export const codeWithCalloutProps = t.object({
  ...steps,
  title,
  code: t.object({
    ...steps,
    lang: short(24),
    /** Never trimmed: leading indentation is part of the code. */
    source: t.string({ min: 1, max: 8_000, text: 'multiline' }),
    /** Line ranges such as `1` or `3-5`; the stage reveals each one as a step. */
    highlights: t.optional(t.array(short(32), { max: 16 })),
  }),
  heading: optionalShort(80),
  bullets: t.array(short(200), { min: 1, max: 6 }),
});

export const bigStatProps = t.object({
  ...steps,
  number: short(32),
  label: short(200),
  context: optionalShort(200),
  source: optionalShort(160),
});

const comparisonCell = t.union([short(80), t.boolean(), t.null()]);

export const comparisonTableProps = t.refine(
  t.object({
    ...steps,
    title,
    columns: t.array(short(40), { min: 2, max: 4 }),
    rows: t.array(
      t.object({
        ...steps,
        label: short(80),
        values: t.array(comparisonCell, { min: 2, max: 4 }),
      }),
      { min: 3, max: 5 }
    ),
  }),
  {
    code: 'layout-props',
    description: 'Every row has exactly one value per column.',
    check(value, context) {
      const width = value.columns.length;
      value.rows.forEach((row, index) => {
        if (row.values.length !== width) {
          context.issue({
            path: ['rows', index, 'values'],
            message: `This row has ${row.values.length} values for ${width} columns.`,
            fix: `Give every row exactly ${width} values (use null for an empty cell).`,
          });
        }
      });
    },
  }
);

export const processStepsProps = t.object({
  ...steps,
  title,
  steps: t.array(t.object({ ...steps, title: short(80), body: optionalShort(200) }), {
    min: 3,
    max: 5,
  }),
});

export const timelineProps = t.object({
  ...steps,
  title,
  events: t.array(t.object({ ...steps, time: short(40), text: short(200) }), { min: 4, max: 8 }),
});

export const teamAvatarsProps = t.object({
  ...steps,
  title,
  people: t.array(
    t.object({
      ...steps,
      name: short(80),
      role: optionalShort(80),
      /** An avatar id (`av-001`, resolved by the host) or a media source. */
      avatar: t.optional(
        t.string({ min: 1, max: 64, pattern: MEDIA_SRC_PATTERN, trim: true, text: 'line' })
      ),
    }),
    { min: 1, max: 8 }
  ),
});

export const closingCtaProps = t.object({
  ...steps,
  title: short(120),
  text: optionalShort(280),
  cta: t.object({ ...steps, label: short(60), href: layoutHref }),
  footnote: optionalShort(160),
});

export const videoCenteredProps = t.object({
  ...steps,
  title,
  video,
  caption: optionalShort(200),
});

/** `video-left` and `video-right` share one shape. */
export const videoSideProps = t.object({
  ...steps,
  title,
  video,
  heading: optionalShort(80),
  body: short(600),
});

/** Chart data bounds: room for a year of daily points across a few series. */
export const CHART_SPEC_LIMITS = Object.freeze({
  depth: 6,
  maxKeys: 100,
  maxItems: 400,
  maxString: 2_000,
});

const STEP_KEYS = Object.keys(stepFields);
const stepMarker = t.object(stepFields);
const CHART_KIND_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

/**
 * The chart body: a bounded JSON object in the shape of a Texuli chart block
 * without its `type` (`kind`, `title`, `description`, `series` | `cells` |
 * `points`, `props`). The engine stays L0, so it checks only the bounds,
 * `kind` syntax and the step fields here; the stage validates the rest with
 * the chart block parser (24 kinds) after removing the step fields.
 */
export const chartSpec = t.refine(
  t.json({
    depth: CHART_SPEC_LIMITS.depth,
    maxKeys: CHART_SPEC_LIMITS.maxKeys,
    maxItems: CHART_SPEC_LIMITS.maxItems,
    maxString: CHART_SPEC_LIMITS.maxString,
    text: 'multiline',
  }),
  {
    code: 'layout-props',
    description:
      'A chart block without `type`: an object with a `kind`, validated by the stage chart block parser; may carry step fields.',
    check(value, context) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        context.issue({
          message: 'The chart spec must be an object.',
          fix: 'Use a chart block body such as {"kind": "bar", "title": "…", "description": "…", "series": […]}.',
        });
        return;
      }
      if (Object.hasOwn(value, 'type')) {
        context.issue({
          path: ['type'],
          message: 'The chart layout sets the block type itself.',
          fix: 'Remove `type` from the chart spec.',
        });
      }
      const kind = value.kind;
      if (typeof kind !== 'string' || !CHART_KIND_PATTERN.test(kind)) {
        context.issue({
          path: ['kind'],
          message: 'The chart spec needs a `kind` such as "bar" or "line".',
          fix: 'Set `kind` to one of the chart block kinds.',
        });
      }
      const marker: Record<string, unknown> = {};
      for (const key of STEP_KEYS) if (Object.hasOwn(value, key)) marker[key] = value[key];
      for (const issue of validate(stepMarker, marker).issues) {
        context.issue({ code: issue.code, path: issue.path, message: issue.message });
      }
    },
  }
);

export const chartProps = t.object({
  ...steps,
  title,
  spec: chartSpec,
  height: t.optional(t.enum(['sm', 'md', 'lg'])),
  showTable: t.optional(t.boolean()),
});
