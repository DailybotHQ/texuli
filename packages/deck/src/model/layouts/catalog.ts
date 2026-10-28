/**
 * The deck layout catalog (model-v2 §3.3): 20 layouts with strict props plus
 * `free`, the slide kind whose content is a list of blocks. Data only: ids,
 * copy for authors and agents, pacing fit, limits, the props schema, a valid
 * sample and the paths where a step marker reveals an element.
 */
import {
  createDiagnostic,
  type DeckDiagnostic,
  type Infer,
  type JsonSchema,
  type PathSegment,
  type Schema,
  t,
  toJsonSchema,
  type ValidateOptions,
  type ValidateResult,
  validate,
} from '../../schema/index.ts';
import {
  bigStatProps,
  chartProps,
  closingCtaProps,
  codeWithCalloutProps,
  comparisonTableProps,
  imageCenteredProps,
  imageFullBleedProps,
  imageSideProps,
  processStepsProps,
  quoteProps,
  sectionDividerProps,
  teamAvatarsProps,
  threeColumnCardsProps,
  timelineProps,
  titleHeroProps,
  twoColumnSplitProps,
  videoCenteredProps,
  videoSideProps,
} from './props.ts';

/**
 * Pacing fit: `punch` lands in a few seconds, `idea` carries one thought,
 * `diagram` explains a structure, `story` moves the narrative.
 */
export const LAYOUT_PACING = ['punch', 'idea', 'diagram', 'story'] as const;
export type LayoutPacing = (typeof LAYOUT_PACING)[number];

/** The 20 layouts with strict props, in catalog order. */
export const DECK_CATALOG_LAYOUT_IDS = Object.freeze([
  'title-hero',
  'section-divider',
  'two-column-split',
  'three-column-cards',
  'image-left',
  'image-right',
  'image-centered',
  'image-full-bleed',
  'quote',
  'code-with-callout',
  'big-stat',
  'comparison-table',
  'process-steps',
  'timeline',
  'team-avatars',
  'closing-cta',
  'video-centered',
  'video-left',
  'video-right',
  'chart',
] as const);
export type DeckCatalogLayoutId = (typeof DECK_CATALOG_LAYOUT_IDS)[number];

/** Every catalog id: the 20 props layouts and `free` (21). */
export const DECK_LAYOUT_IDS = Object.freeze([...DECK_CATALOG_LAYOUT_IDS, 'free'] as const);
export type DeckLayoutId = (typeof DECK_LAYOUT_IDS)[number];

/** The props schema of each catalog layout. */
const PROPS_SCHEMAS = {
  'title-hero': titleHeroProps,
  'section-divider': sectionDividerProps,
  'two-column-split': twoColumnSplitProps,
  'three-column-cards': threeColumnCardsProps,
  'image-left': imageSideProps,
  'image-right': imageSideProps,
  'image-centered': imageCenteredProps,
  'image-full-bleed': imageFullBleedProps,
  quote: quoteProps,
  'code-with-callout': codeWithCalloutProps,
  'big-stat': bigStatProps,
  'comparison-table': comparisonTableProps,
  'process-steps': processStepsProps,
  timeline: timelineProps,
  'team-avatars': teamAvatarsProps,
  'closing-cta': closingCtaProps,
  'video-centered': videoCenteredProps,
  'video-left': videoSideProps,
  'video-right': videoSideProps,
  chart: chartProps,
} as const satisfies Record<DeckCatalogLayoutId, Schema>;

/** The validated props type of each catalog layout. */
export type LayoutProps = {
  [K in DeckCatalogLayoutId]: Infer<(typeof PROPS_SCHEMAS)[K]>;
};

export interface LayoutLimits {
  /** Human-readable limit lines for authors, agents and docs. */
  summary: readonly string[];
}

interface EntryCopy {
  label: string;
  description: string;
  useWhen: readonly string[];
  dontUseWhen: readonly string[];
  pacing: readonly LayoutPacing[];
  limits: LayoutLimits;
  /**
   * Where a step marker reveals an element, relative to `props`: `''` is the
   * whole body, a key is a nested object, `key.*` is each item of a list.
   */
  steppable: readonly string[];
}

/** A catalog layout with strict props. */
export interface DeckLayoutEntry<Id extends DeckCatalogLayoutId = DeckCatalogLayoutId>
  extends EntryCopy {
  id: Id;
  kind: 'props';
  props: (typeof PROPS_SCHEMAS)[Id];
  /** A minimal valid sample with fictional data. */
  sample: LayoutProps[Id];
}

/**
 * `free`: a slide kind, not a props layout. Its blocks are validated by the
 * blocks pass of the deck schema, so it has no props schema and no sample here.
 */
export interface DeckFreeLayoutEntry extends EntryCopy {
  id: 'free';
  kind: 'blocks';
  props: null;
  sample: null;
}

export type DeckLayoutCatalogEntry = DeckLayoutEntry | DeckFreeLayoutEntry;

export type DeckLayoutCatalog = {
  readonly [K in DeckCatalogLayoutId]: DeckLayoutEntry<K>;
} & { readonly free: DeckFreeLayoutEntry };

const IMAGE = {
  src: 'https://example.com/media/diagram.webp',
  alt: 'A placeholder diagram with three connected boxes',
  width: 640,
  height: 480,
};

const VIDEO = {
  src: 'https://example.com/media/demo.mp4',
  label: 'Product demo clip',
  width: 960,
  height: 540,
  muted: true,
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function entry<Id extends DeckCatalogLayoutId>(
  id: Id,
  copy: Omit<EntryCopy, 'limits'> & { limits: readonly string[] },
  sample: LayoutProps[Id]
): DeckLayoutEntry<Id> {
  return {
    id,
    kind: 'props',
    label: copy.label,
    description: copy.description,
    useWhen: copy.useWhen,
    dontUseWhen: copy.dontUseWhen,
    pacing: copy.pacing,
    limits: { summary: copy.limits },
    steppable: copy.steppable,
    props: PROPS_SCHEMAS[id],
    sample,
  };
}

/** The layout catalog, keyed by id in catalog order (deeply frozen). */
export const DECK_LAYOUTS: DeckLayoutCatalog = deepFreeze({
  'title-hero': entry(
    'title-hero',
    {
      label: 'Title hero',
      description: 'The cover: a title, a subtitle and a meta line.',
      useWhen: ['The first slide of a deck: title, subtitle, speaker and event.'],
      dontUseWhen: ['Any slide other than the cover.'],
      pacing: ['punch', 'story'],
      limits: ['title 1–100 characters', 'optional subtitle and meta, 160 characters each'],
      steppable: [''],
    },
    {
      title: 'Shipping calmer releases',
      subtitle: 'What a small team learned in one year',
      meta: 'Ada Example · Example Conf · 2026',
    }
  ),
  'section-divider': entry(
    'section-divider',
    {
      label: 'Section divider',
      description: 'A chapter break with an optional eyebrow.',
      useWhen: ['Opening a new chapter or section of the deck.'],
      dontUseWhen: ['Carrying content: a divider pauses the audience, it does not inform.'],
      pacing: ['punch'],
      limits: ['title 1–120 characters', 'optional eyebrow, 80 characters'],
      steppable: [''],
    },
    { eyebrow: 'Part 2', title: 'How the pipeline works' }
  ),
  'two-column-split': entry(
    'two-column-split',
    {
      label: 'Two-column split',
      description: 'Two parallel text columns.',
      useWhen: ['Two ideas side by side: before and after, problem and solution.'],
      dontUseWhen: ['There are three or more items (use three-column-cards or a list).'],
      pacing: ['idea', 'diagram'],
      limits: ['exactly two columns', 'body 1–600 characters each', 'optional heading, 80'],
      steppable: ['', 'left', 'right'],
    },
    {
      title: 'Before and after',
      left: { heading: 'Before', body: 'Releases waited for a weekly window.' },
      right: { heading: 'After', body: 'Every merged change ships the same day.' },
    }
  ),
  'three-column-cards': entry(
    'three-column-cards',
    {
      label: 'Three-column cards',
      description: 'Three parallel cards, each with an icon, a heading and a body.',
      useWhen: ['Three parallel concepts: pillars, features or principles.'],
      dontUseWhen: ['There are more or fewer than three items.'],
      pacing: ['idea', 'diagram'],
      limits: ['exactly 3 cards', 'heading 1–80, body 1–280 characters', 'optional icon name'],
      steppable: ['', 'cards.*'],
    },
    {
      title: 'Three principles',
      cards: [
        { icon: 'zap', heading: 'Small', body: 'Ship the smallest useful change first.' },
        { icon: 'compass', heading: 'Clear', body: 'One sentence explains every change.' },
        { icon: 'users', heading: 'Shared', body: 'Anyone on the team can release.' },
      ],
    }
  ),
  'image-left': entry(
    'image-left',
    {
      label: 'Image left',
      description: 'An image with explanatory text beside it, image first.',
      useWhen: ['Walking through a screenshot, photo or diagram with some text.'],
      dontUseWhen: ['The image is the whole message (use image-full-bleed).'],
      pacing: ['idea', 'diagram'],
      limits: ['one image with alt text', 'body 1–600 characters'],
      steppable: ['', 'image'],
    },
    {
      title: 'The release board',
      image: IMAGE,
      heading: 'What you are looking at',
      body: 'Each box is a stage; a change moves right when its checks pass.',
    }
  ),
  'image-right': entry(
    'image-right',
    {
      label: 'Image right',
      description: 'Explanatory text with an image beside it, text first.',
      useWhen: ['The idea comes first and the image anchors it.'],
      dontUseWhen: ['The image needs to be read before the text (use image-left).'],
      pacing: ['idea', 'story'],
      limits: ['one image with alt text', 'body 1–600 characters'],
      steppable: ['', 'image'],
    },
    {
      title: 'Lead with the idea',
      image: IMAGE,
      heading: 'Checks run in parallel',
      body: 'Say it first, then show where it happens.',
    }
  ),
  'image-centered': entry(
    'image-centered',
    {
      label: 'Image centered',
      description: 'One image is the focus, with a title and a caption.',
      useWhen: ['A single diagram, screenshot or chart image is the point of the slide.'],
      dontUseWhen: [
        'The image needs text beside it (use image-left or image-right).',
        'The image should fill the slide (use image-full-bleed).',
      ],
      pacing: ['diagram', 'punch'],
      limits: ['one image with alt text', 'optional caption, 200 characters'],
      steppable: ['', 'image'],
    },
    { title: 'The whole pipeline', image: IMAGE, caption: 'Three stages, one direction.' }
  ),
  'image-full-bleed': entry(
    'image-full-bleed',
    {
      label: 'Image full bleed',
      description: 'An image fills the slide, with an optional caption and credit.',
      useWhen: ['The image is the message: a hero photo or a quote on an image.'],
      dontUseWhen: ['There is substantial text to say (use image-left or image-right).'],
      pacing: ['punch', 'story'],
      limits: ['one image with alt text', 'optional caption (200) and credit (160)'],
      steppable: ['', 'image'],
    },
    {
      image: IMAGE,
      caption: 'Where it started',
      credit: 'Photo: Example Studio',
      overlay: 'dark',
    }
  ),
  quote: entry(
    'quote',
    {
      label: 'Quote',
      description: 'One short pull quote with its source.',
      useWhen: ['A short quote that earns a slide of its own.'],
      dontUseWhen: ['The quote cannot be attributed, or runs past two lines.'],
      pacing: ['punch', 'story'],
      limits: ['quote 1–280 characters', 'optional cite, 120 characters'],
      steppable: [''],
    },
    { quote: 'Make the next step obvious, then make it small.', cite: 'Marco Example' }
  ),
  'code-with-callout': entry(
    'code-with-callout',
    {
      label: 'Code with callout',
      description: 'A code block beside a short explanation.',
      useWhen: ['Explaining what a short piece of code does.'],
      dontUseWhen: ['The code is too long for a slide: trim it and step through highlights.'],
      pacing: ['diagram', 'idea'],
      limits: [
        'source 1–8,000 characters, kept verbatim',
        '1–6 bullets of up to 200 characters',
        'up to 16 highlight ranges, each revealed as a step',
      ],
      steppable: ['', 'code'],
    },
    {
      title: 'One function, one job',
      code: {
        lang: 'ts',
        source:
          'export function total(items: number[]) {\n  return items.reduce((a, b) => a + b, 0);\n}',
        highlights: ['2'],
      },
      heading: 'What is happening',
      bullets: ['Sum the list in one pass', 'Start from zero for an empty list'],
    }
  ),
  'big-stat': entry(
    'big-stat',
    {
      label: 'Big stat',
      description: 'One number that lands a point.',
      useWhen: ['A single number makes the case: adoption, scale, time saved.'],
      dontUseWhen: ['The trend matters more than the number (use chart).'],
      pacing: ['punch'],
      limits: ['number 1–32 characters', 'label 1–200 characters', 'optional context and source'],
      steppable: [''],
    },
    {
      number: '87%',
      label: 'of releases shipped on the day they merged',
      context: 'A fictional team, over twelve months',
      source: 'n = 412 releases',
    }
  ),
  'comparison-table': entry(
    'comparison-table',
    {
      label: 'Comparison table',
      description: 'Two to four options compared across three to five attributes.',
      useWhen: ['Comparing 2–4 options across 3–5 attributes.'],
      dontUseWhen: ['There are more than four options or five attributes.'],
      pacing: ['diagram', 'idea'],
      limits: ['2–4 columns', '3–5 rows', 'every row has one value per column'],
      steppable: ['', 'rows.*'],
    },
    {
      title: 'Two ways to release',
      columns: ['Weekly window', 'Continuous'],
      rows: [
        { label: 'Lead time', values: ['5 days', 'Same day'] },
        { label: 'Rollback', values: [false, true] },
        { label: 'Best for', values: ['Large batches', 'Small changes'] },
      ],
    }
  ),
  'process-steps': entry(
    'process-steps',
    {
      label: 'Process steps',
      description: 'A linear process of three to five steps.',
      useWhen: ['A 3–5 step process or workflow.'],
      dontUseWhen: ['There are more than five steps (use timeline) or the order does not matter.'],
      pacing: ['idea', 'diagram'],
      limits: ['3–5 steps', 'title 1–80, optional body 200 characters'],
      steppable: ['', 'steps.*'],
    },
    {
      title: 'How a change ships',
      steps: [
        { title: 'Propose', body: 'Open a small pull request.' },
        { title: 'Check', body: 'Tests and reviews run in parallel.' },
        { title: 'Merge', body: 'The branch lands on main.' },
        { title: 'Release', body: 'The pipeline publishes it.' },
      ],
    }
  ),
  timeline: entry(
    'timeline',
    {
      label: 'Timeline',
      description: 'Four to eight dated events that tell a story.',
      useWhen: ['4–8 dated events that form a story arc.'],
      dontUseWhen: ['The dates do not matter, or there are more than eight events.'],
      pacing: ['story', 'diagram'],
      limits: ['4–8 events', 'time 1–40, text 1–200 characters'],
      steppable: ['', 'events.*'],
    },
    {
      title: 'One year of releases',
      events: [
        { time: 'January', text: 'First automated release' },
        { time: 'April', text: 'Checks run in parallel' },
        { time: 'August', text: 'Same-day releases by default' },
        { time: 'December', text: 'Rollback in one click' },
      ],
    }
  ),
  'team-avatars': entry(
    'team-avatars',
    {
      label: 'Team avatars',
      description: 'Up to eight people with roles and optional avatars.',
      useWhen: ['Introducing the team or the co-presenters.'],
      dontUseWhen: ['There are more than eight people (group them instead).'],
      pacing: ['idea', 'story'],
      limits: ['1–8 people', 'name 1–80, optional role 80', 'optional avatar id or media source'],
      steppable: ['', 'people.*'],
    },
    {
      title: 'The team',
      people: [
        { name: 'Ada Example', role: 'Design', avatar: 'av-001' },
        { name: 'Marco Example', role: 'Engineering', avatar: 'av-002' },
      ],
    }
  ),
  'closing-cta': entry(
    'closing-cta',
    {
      label: 'Closing call to action',
      description: 'The last slide, with one primary action.',
      useWhen: ['The final slide: what to do next and where to go.'],
      dontUseWhen: ['In the middle of the deck (use section-divider for a break).'],
      pacing: ['punch', 'story'],
      limits: [
        'title 1–120 characters',
        'one link: label 1–60, href up to 512',
        'optional footnote',
      ],
      steppable: ['', 'cta'],
    },
    {
      title: 'Thank you',
      text: 'Questions are welcome after the talk.',
      cta: { label: 'Read the guide', href: 'https://example.com/guide' },
      footnote: 'All names and numbers are fictional.',
    }
  ),
  'video-centered': entry(
    'video-centered',
    {
      label: 'Video centered',
      description: 'One video is the focus, with a title and a caption.',
      useWhen: ['A single demo, trailer or explainer clip is the point of the slide.'],
      dontUseWhen: ['The video needs text beside it (use video-left or video-right).'],
      pacing: ['diagram', 'story'],
      limits: ['one video', 'optional caption, 200 characters'],
      steppable: ['', 'video'],
    },
    { title: 'The demo', video: VIDEO, caption: 'Recorded on a test project.' }
  ),
  'video-left': entry(
    'video-left',
    {
      label: 'Video left',
      description: 'A video with explanatory text beside it, video first.',
      useWhen: ['Walking through a demo or clip with some text.'],
      dontUseWhen: ['The video is the only focus (use video-centered).'],
      pacing: ['idea', 'diagram'],
      limits: ['one video', 'body 1–600 characters'],
      steppable: ['', 'video'],
    },
    {
      title: 'A release in one minute',
      video: VIDEO,
      heading: 'What you are watching',
      body: 'A change goes from merge to production while the checks report.',
    }
  ),
  'video-right': entry(
    'video-right',
    {
      label: 'Video right',
      description: 'Explanatory text with a video beside it, text first.',
      useWhen: ['The idea comes first and the clip shows it.'],
      dontUseWhen: ['The video needs to be watched before the text (use video-left).'],
      pacing: ['idea', 'story'],
      limits: ['one video', 'body 1–600 characters'],
      steppable: ['', 'video'],
    },
    {
      title: 'Lead with the idea',
      video: VIDEO,
      heading: 'Rollback is one click',
      body: 'Say it first, then let the clip prove it.',
    }
  ),
  chart: entry(
    'chart',
    {
      label: 'Chart',
      description: 'A chart block (any Texuli chart kind) with an optional data table.',
      useWhen: ['A trend or a distribution is clearer as a chart than as a number or a table.'],
      dontUseWhen: ['One number makes the point (use big-stat).'],
      pacing: ['diagram', 'idea'],
      limits: [
        'spec: a chart block without `type`, checked by the stage chart block parser',
        'spec JSON: depth 6, 100 keys per object, 400 items per array',
        'optional height (sm, md, lg) and data table',
      ],
      steppable: ['', 'spec'],
    },
    {
      title: 'Releases per month',
      spec: {
        kind: 'bar',
        title: 'Releases per month',
        description: 'Releases grew from 12 in January to 31 in March.',
        series: [
          {
            id: 'releases',
            label: 'Releases',
            points: [
              { x: 'Jan', y: 12 },
              { x: 'Feb', y: 22 },
              { x: 'Mar', y: 31 },
            ],
          },
        ],
      },
      height: 'md',
      showTable: true,
    }
  ),
  free: {
    id: 'free',
    kind: 'blocks',
    label: 'Free blocks',
    description: 'A list of validated content blocks, for when no layout fits.',
    useWhen: ['No catalog layout fits the idea; compose it from content blocks.'],
    dontUseWhen: ['A catalog layout already fits: prefer it for lint, pacing and steps.'],
    pacing: ['punch', 'idea', 'diagram', 'story'],
    limits: {
      summary: [
        '1–2,000 top-level blocks; lint warns past 48',
        'each block follows the blocks schema and may carry step fields',
      ],
    },
    steppable: [],
    props: null,
    sample: null,
  },
} satisfies DeckLayoutCatalog);

/** Codes this module adds to the schema kit's own. */
export const LAYOUT_CODES = Object.freeze({
  unknownLayout: 'unknown-layout',
  layoutProps: 'layout-props',
} as const);

/** True for the 21 catalog ids (own keys only, so `constructor` is never one). */
export function isLayoutId(value: unknown): value is DeckLayoutId {
  return typeof value === 'string' && (DECK_LAYOUT_IDS as readonly string[]).includes(value);
}

/** True for the 20 layouts that take strict props (every id but `free`). */
export function isCatalogLayoutId(value: unknown): value is DeckCatalogLayoutId {
  return (
    typeof value === 'string' && (DECK_CATALOG_LAYOUT_IDS as readonly string[]).includes(value)
  );
}

/** The catalog entry for `id`, or `undefined`. */
export function getDeckLayout(id: unknown): DeckLayoutCatalogEntry | undefined {
  return isLayoutId(id) ? DECK_LAYOUTS[id] : undefined;
}

/** The props schema of a catalog layout; `undefined` for `free` and unknown ids. */
export function layoutPropsSchema<Id extends DeckCatalogLayoutId>(
  id: Id
): (typeof PROPS_SCHEMAS)[Id];
export function layoutPropsSchema(id: unknown): Schema | undefined;
export function layoutPropsSchema(id: unknown): Schema | undefined {
  return isCatalogLayoutId(id) ? PROPS_SCHEMAS[id] : undefined;
}

/** The steppable path patterns of `id` (`''`, `image`, `cards.*`); empty when unknown. */
export function layoutSteppablePaths(id: unknown): readonly string[] {
  return isLayoutId(id) ? DECK_LAYOUTS[id].steppable : [];
}

/** The pattern of a path inside `props`: `[]` → `''`, `['cards', 2]` → `cards.*`. */
export function steppablePattern(path: readonly PathSegment[]): string {
  return path.map((part) => (typeof part === 'number' ? '*' : part)).join('.');
}

/** Whether `layout` reveals a step marker found at `path` (relative to `props`). */
export function isSteppablePath(layout: unknown, path: readonly PathSegment[]): boolean {
  return layoutSteppablePaths(layout).includes(steppablePattern(path));
}

export interface LayoutValidateOptions extends ValidateOptions {
  /**
   * Where an `unknown-layout` issue points. Defaults to the sibling `layout`
   * key when `path` ends in `props` (`['slides', 3, 'layout']`), else `path`.
   */
  layoutPath?: readonly PathSegment[];
}

function failure(issue: DeckDiagnostic): ValidateResult<never> {
  return { ok: false, issues: [issue], normalized: [], truncated: false };
}

/**
 * Validate the props of a layout: every issue as a `DeckDiagnostic`, a fresh
 * trimmed copy on success, never a throw. An unknown id reports
 * `unknown-layout`; `free` (which has blocks, not props) and the layouts'
 * cross-field rules report `layout-props`; field issues keep the kit's codes.
 */
export function validateLayoutProps<Id extends DeckCatalogLayoutId>(
  id: Id,
  props: unknown,
  options?: LayoutValidateOptions
): ValidateResult<LayoutProps[Id]>;
export function validateLayoutProps(
  id: unknown,
  props: unknown,
  options?: LayoutValidateOptions
): ValidateResult<unknown>;
export function validateLayoutProps(
  id: unknown,
  props: unknown,
  options: LayoutValidateOptions = {}
): ValidateResult<unknown> {
  const path = options.path ?? [];
  if (isCatalogLayoutId(id)) {
    const { layoutPath: _ignored, ...rest } = options;
    return validate(PROPS_SCHEMAS[id], props, rest);
  }
  if (id === 'free') {
    return failure(
      createDiagnostic(LAYOUT_CODES.layoutProps, 'A free slide has blocks, not props.', path, {
        fix: 'Move the content into the slide `blocks` list, or pick a catalog layout.',
      })
    );
  }
  const layoutPath =
    options.layoutPath ??
    (path.length > 0 && path[path.length - 1] === 'props'
      ? [...path.slice(0, -1), 'layout']
      : path);
  const shown = typeof id === 'string' ? JSON.stringify(id.slice(0, 64)) : `of type ${typeof id}`;
  return failure(
    createDiagnostic(LAYOUT_CODES.unknownLayout, `Unknown layout ${shown}.`, layoutPath, {
      fix: `Use one of: ${DECK_LAYOUT_IDS.join(', ')}.`,
    })
  );
}

/**
 * One JSON Schema 2020-12 document for every catalog layout's props: a
 * `$defs` entry named by layout id (`#/$defs/title-hero`), and a root that
 * accepts any of them. `free` has no entry (its blocks belong to the deck
 * schema). Refinements are described in `description`.
 */
export function layoutsJsonSchema(): JsonSchema {
  const refs = DECK_CATALOG_LAYOUT_IDS.map((id) =>
    t.lazy((): Schema => PROPS_SCHEMAS[id], {
      name: id,
      description: `Props of the ${DECK_LAYOUTS[id].label.toLowerCase()} layout.`,
    })
  );
  const [first, ...more] = refs;
  if (first === undefined) return toJsonSchema(t.object({}));
  return toJsonSchema(t.union([first, ...more]), {
    title: 'Texuli deck layout props',
    description: 'The props of one deck layout; pick the definition named by the slide layout id.',
  });
}
