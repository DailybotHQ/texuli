/**
 * The /motion-page/ blueprint: an agent declares motion as data (spec
 * 0.6.0, a closed vocabulary of presets and token steps) and the player
 * paints it. Fictional data only (Harbor Notes, example.com). The unit test
 * runs both through the same check the JSON live preview uses: the motion
 * blueprint passes with zero errors, and the hostile one is refused at the
 * node's `motion`.
 */

const CATALOG_PIN = '0'.repeat(64);

const showDetails = {
  op: 'eq',
  left: { op: 'var', name: 'details' },
  right: { op: 'num', value: 1 },
} as const;

function envelope(id: string, tree: Record<string, unknown>): Record<string, unknown> {
  return {
    format: 'texuli-blueprint',
    version: 1,
    spec: '0.6.0',
    id,
    catalog: CATALOG_PIN,
    status: 'draft',
    createdAt: '2026-10-28T09:00:00Z',
    updatedAt: '2026-10-28T09:00:00Z',
    generator: { kind: 'agent', name: 'Harbor assistant', model: 'example-model' },
    state: { details: { type: 'boolean', initial: false } },
    motion: { level: 'full' },
    tree,
  };
}

const text = (markdown: string) => ({
  id: 'blocks-text',
  props: { block: { type: 'text', markdown } },
});

const tile = (title: string, body: string, enter: string) => ({
  id: 'layout-card',
  props: { title },
  when: showDetails,
  motion: { enter, exit: 'fade', duration: 'base' },
  children: [text(body)],
});

/** The motion blueprint: a toggle shows three staggered cards and a risk review. */
export const MOTION_BLUEPRINT: Readonly<Record<string, unknown>> = envelope(
  'motion-release-brief',
  {
    id: 'layout-page',
    props: {
      title: 'Release brief, week 44',
      description: 'Harbor Notes ships on Thursday. Turn on the details to see what is left.',
    },
    children: [
      { id: 'control-toggle', props: { label: 'Show the details', state: 'details' } },
      {
        id: 'layout-grid',
        props: { columns: 3 },
        motion: { stagger: 'base' },
        children: [
          tile('Docs', 'Two guides left to review.', 'rise'),
          tile('Checks', 'All green on the release branch.', 'rise'),
          tile('Launch post', 'Draft shared with the crew.', 'rise'),
        ],
      },
      {
        id: 'layout-card',
        props: { title: 'Risk review' },
        when: showDetails,
        motion: { enter: 'scale', exit: 'fade', duration: 'slow', layout: true },
        children: [text('The status page at status.example.com needs one more check.')],
      },
    ],
  }
);

/** The same brief, but one node asks for motion outside the vocabulary. */
export const HOSTILE_BLUEPRINT: Readonly<Record<string, unknown>> = envelope(
  'motion-release-brief-hostile',
  {
    id: 'layout-page',
    props: {
      title: 'Release brief, week 44',
      description: 'One card asks for a spin and raw keyframes; the player refuses that motion.',
    },
    children: [
      { id: 'control-toggle', props: { label: 'Show the details', state: 'details' } },
      {
        id: 'layout-card',
        props: { title: 'Risk review' },
        when: showDetails,
        motion: { enter: 'spin', keyframes: [{ transform: 'rotate(720deg)' }] },
        children: [text('This card paints without its motion.')],
      },
    ],
  }
);

/** The blueprints as the page prints them. */
export const MOTION_BLUEPRINT_JSON = JSON.stringify(MOTION_BLUEPRINT, null, 2);
export const HOSTILE_MOTION_JSON = JSON.stringify(
  (HOSTILE_BLUEPRINT.tree as { children: unknown[] }).children[1],
  null,
  2
);
