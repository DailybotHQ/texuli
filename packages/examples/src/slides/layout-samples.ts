/**
 * Deck model v2 samples for the layout examples (T-layouts-backgrounds): one
 * single-slide deck per catalog layout, plus the backgrounds gallery. Plain
 * data that `DeckStage` validates itself (`deck: unknown`), so the examples
 * need no model import. Fictional Harborline and Example Co. content only;
 * one-pixel raster swatches stand in for photos (no network).
 */

/** One-pixel raster swatches (the same ones the v1 slides samples use). */
export const LAYOUT_SWATCH = {
  teal: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPgK5nwHwADuAISVL3raQAAAABJRU5ErkJggg==',
  amber:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO4Wc72HwAF2QJWAddyIQAAAABJRU5ErkJggg==',
  slate:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNwD838DwAD8QIFo4kWdAAAAABJRU5ErkJggg==',
} as const;

const image = (src: string, alt: string) => ({ src, alt, width: 1280, height: 720 });
/** A relative clip path: no file ships with the examples, so the player shows its own fallback. */
const VIDEO = {
  src: 'media/harborline-demo.mp4',
  label: 'Harborline route demo',
  width: 1280,
  height: 720,
};

/** The props of each catalog layout's example slide. */
export const LAYOUT_EXAMPLE_PROPS = {
  'title-hero': {
    title: 'Harborline: shipping, simplified',
    subtitle: 'How a fictional freight team cut manifest errors in one quarter',
    meta: 'Example Co. · Quarterly review · 2026',
  },
  'section-divider': { eyebrow: 'Chapter 02', title: 'What we learned at the docks' },
  'two-column-split': {
    title: 'Before and after',
    left: {
      heading: 'Before',
      body: 'Manifests typed by hand, checked twice, and still wrong one time in twelve.',
    },
    right: {
      heading: 'After',
      body: 'Manifests generated from the booking, validated before the truck leaves.',
    },
  },
  'three-column-cards': {
    title: 'Three pillars',
    cards: [
      { icon: 'zap', heading: 'Speed', body: 'Ship the smallest valuable change first.' },
      { icon: 'compass', heading: 'Clarity', body: 'One sentence should explain each route.' },
      { icon: 'users', heading: 'Trust', body: 'Every handoff names its owner.' },
    ],
  },
  'image-left': {
    title: 'The live map',
    image: image(LAYOUT_SWATCH.teal, 'A teal placeholder for the container map'),
    heading: 'What you are looking at',
    body: 'Every container on one map, colored by how late it is.',
  },
  'image-right': {
    title: 'The dock view',
    image: image(LAYOUT_SWATCH.amber, 'An amber placeholder for the dock camera'),
    heading: 'Lead with the idea',
    body: 'Crews see the next three trucks before they arrive.',
  },
  'image-centered': {
    title: 'Routes this week',
    image: image(LAYOUT_SWATCH.slate, 'A slate placeholder for the route chart'),
    caption: 'Fictional routes between three example ports.',
  },
  'image-full-bleed': {
    image: image(LAYOUT_SWATCH.teal, 'A teal placeholder for a harbor photo'),
    caption: 'The harbor at 6 a.m., before the first shift.',
    credit: 'Placeholder image, Example Co.',
    overlay: 'dark',
  },
  quote: {
    quote: 'We stopped arguing about manifests and started shipping.',
    cite: 'A fictional dock lead',
  },
  'code-with-callout': {
    title: 'Validating a manifest',
    code: {
      lang: 'ts',
      source:
        'const manifest = parseManifest(input);\nif (!manifest.ok) {\n  return reject(manifest.issues);\n}\nawait ship(manifest.value);',
      highlights: ['1', '2-4', '5'],
    },
    heading: 'What happens',
    bullets: [
      'Parse the booking into a manifest',
      'Refuse it with every issue listed',
      'Ship only what validated',
    ],
  },
  'big-stat': {
    number: '87%',
    label: 'fewer manifest errors after one quarter',
    context: 'Fictional cohort of 12 example docks.',
    source: 'Example Co. operations data',
  },
  'comparison-table': {
    title: 'Which plan fits',
    columns: ['Starter', 'Team', 'Fleet'],
    rows: [
      { label: 'Routes', values: ['5', '50', 'Unlimited'] },
      { label: 'Live map', values: [false, true, true] },
      { label: 'Audit log', values: [null, true, true] },
      { label: 'Support', values: ['Email', 'Chat', '24/7'] },
    ],
  },
  'process-steps': {
    title: 'How a booking ships',
    steps: [
      { title: 'Book', body: 'The customer picks a route.' },
      { title: 'Validate', body: 'The manifest is checked.' },
      { title: 'Load', body: 'Crews see what goes where.' },
      { title: 'Ship', body: 'The truck leaves on time.' },
    ],
  },
  timeline: {
    title: 'Harborline so far',
    events: [
      { time: 'Jan', text: 'First pilot at one dock' },
      { time: 'Mar', text: 'Generated manifests' },
      { time: 'Jun', text: 'Live container map' },
      { time: 'Sep', text: 'Twelve docks live' },
      { time: 'Dec', text: 'Audit log for every handoff' },
    ],
  },
  'team-avatars': {
    title: 'The team',
    people: [
      { name: 'Ada Example', role: 'Design' },
      { name: 'Marco Example', role: 'Engineering' },
      { name: 'Lin Example', role: 'Operations' },
      { name: 'Sam Example', role: 'Support' },
    ],
  },
  'closing-cta': {
    title: 'Thank you',
    text: 'Questions welcome after the talk.',
    cta: { label: 'Read the docs', href: 'https://example.com/docs' },
    footnote: 'Fictional company. Example data only.',
  },
  'video-centered': { title: 'The route demo', video: VIDEO, caption: 'A short fictional clip.' },
  'video-left': {
    title: 'Watch a handoff',
    video: VIDEO,
    heading: 'What you are watching',
    body: 'A crew loads the next truck from the live map.',
  },
  'video-right': {
    title: 'Rollback in one click',
    video: VIDEO,
    heading: 'Lead with the idea',
    body: 'Say it first, then let the clip prove it.',
  },
  chart: {
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
  },
} as const;

export type LayoutExampleId = keyof typeof LAYOUT_EXAMPLE_PROPS;

/** A single-slide v2 deck showing one layout. */
export function layoutExampleDeck(layout: LayoutExampleId): unknown {
  return {
    formatVersion: 2,
    meta: { title: `Layout: ${layout}`, locale: 'en' },
    style: { theme: 'graphite', aspect: '16:9' },
    slides: [{ id: 'example', layout, props: structuredClone(LAYOUT_EXAMPLE_PROPS[layout]) }],
  };
}

/** The 13 presets, then one spec of each kind (the gallery's slides). */
export const BACKGROUND_EXAMPLES = [
  'solid-color',
  'solid-surface',
  'solid-primary',
  'solid-accent',
  'solid-muted',
  'solid-inverse',
  'gradient-brand',
  'gradient-dusk',
  'gradient-dawn',
  'gradient-forest',
  'gradient-mist',
  'pattern-dots',
  'pattern-grid',
  { kind: 'solid', color: '#0f766e' },
  { kind: 'gradient', gradient: 'dusk', angle: 45 },
  { kind: 'image', src: LAYOUT_SWATCH.amber, tone: 'light' },
  { kind: 'image-full', src: LAYOUT_SWATCH.slate, tone: 'dark', overlay: 0.3 },
] as const;

/** A label for one gallery background. */
export function backgroundLabel(background: (typeof BACKGROUND_EXAMPLES)[number]): string {
  if (typeof background === 'string') return background;
  if ('color' in background) return `solid ${background.color}`;
  if ('gradient' in background) return `gradient ${background.gradient} ${background.angle}°`;
  return `${background.kind}, ${background.tone} tone`;
}

/**
 * A one-slide deck per gallery background: a free slide (heading and text,
 * painted by the stage's built-in block renderer) over it.
 */
export function backgroundExampleDeck(index: number): unknown {
  const background = BACKGROUND_EXAMPLES[index] ?? 'solid-color';
  return {
    formatVersion: 2,
    meta: { title: `Background: ${backgroundLabel(background)}`, locale: 'en' },
    style: { theme: 'graphite', aspect: '16:9', slideNumbers: false, progress: 'none' },
    slides: [
      {
        id: 'background',
        layout: 'free',
        master: 'section',
        blocks: [
          { type: 'heading', level: 2, text: backgroundLabel(background) },
          { type: 'text', markdown: 'Body text keeps 4.5:1 contrast over this background.' },
        ],
        background,
      },
    ],
  };
}
