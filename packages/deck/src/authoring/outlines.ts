import type { Deck } from '../model/index.ts';
import { DECK_LAYOUTS, parseDeck } from '../model/index.ts';
import { type LayoutRequest, selectDeckLayouts } from './select-layouts.ts';

export const DECK_OUTLINE_IDS = [
  'pitch',
  'qbr',
  'launch',
  'status',
  'training',
  'lesson',
  'report',
  'talk',
] as const;
export type DeckOutlineId = (typeof DECK_OUTLINE_IDS)[number];
export type DeckPacing = 'punch' | 'idea' | 'diagram' | 'story';
export interface OutlineSlide {
  key: string;
  role: string;
  pacing: DeckPacing;
  title: string;
  purpose: string;
  optional?: boolean;
}
export interface DeckOutlineTemplate {
  id: DeckOutlineId;
  label: string;
  cues: readonly string[];
  slides: readonly OutlineSlide[];
}

const core = (
  key: string,
  role: string,
  pacing: DeckPacing,
  title: string,
  purpose: string,
  optional = false
): OutlineSlide => ({ key, role, pacing, title, purpose, ...(optional ? { optional: true } : {}) });
const title = core('title', 'title', 'punch', '', 'Introduce the topic and presenter.');
const close = core(
  'close',
  'close',
  'punch',
  'Close and next steps',
  'Summarize the ask and give a follow-up path.'
);
/** Eight conservative, deterministic brief outlines. They contain prompts, never invented evidence. */
export const DECK_OUTLINES: readonly DeckOutlineTemplate[] = Object.freeze([
  {
    id: 'pitch',
    label: 'Pitch',
    cues: ['pitch', 'investor', 'fundraise'],
    slides: [
      title,
      core('problem', 'problem', 'story', 'The problem', 'Describe who has the problem and when.'),
      core('solution', 'solution', 'idea', 'The solution', 'Explain the proposed solution.'),
      core(
        'why-now',
        'hook',
        'idea',
        'Why now',
        'Name the verified change that makes this timely.',
        true
      ),
      core('product', 'demo', 'story', 'How it works', 'Walk through the user journey.', true),
      core('traction', 'metrics', 'punch', 'Evidence of demand', 'Add sourced traction measures.'),
      core(
        'business-model',
        'solution',
        'idea',
        'Business model',
        'Explain who pays and why.',
        true
      ),
      core(
        'competition',
        'comparison',
        'diagram',
        'Alternatives',
        'Compare approaches fairly.',
        true
      ),
      core('team', 'team', 'idea', 'The team', 'Introduce contributors and relevant experience.'),
      core(
        'roadmap',
        'roadmap',
        'diagram',
        'Roadmap',
        'List milestones and evidence needed.',
        true
      ),
      core('ask', 'ask', 'punch', 'The ask', 'State the request and what it enables.'),
      close,
    ],
  },
  {
    id: 'qbr',
    label: 'Quarterly business review',
    cues: ['qbr', 'quarterly business review', 'quarterly review'],
    slides: [
      title,
      core('agenda', 'agenda', 'idea', 'Agenda', 'List the review topics.'),
      core(
        'highlights',
        'metrics',
        'punch',
        'Quarter highlights',
        'Add sourced performance measures.'
      ),
      core('trend', 'chart', 'diagram', 'Trend', 'Chart a verified measure.', true),
      core('wins', 'findings', 'idea', 'Wins', 'Explain what worked and why.'),
      core('misses', 'risks', 'idea', 'Misses and lessons', 'Describe gaps and lessons.'),
      core('customer', 'quote', 'story', 'Customer voice', 'Add an approved customer quote.', true),
      core('risks', 'risks', 'idea', 'Risks', 'Name risks and mitigation.'),
      core('next', 'roadmap', 'diagram', 'Next quarter', 'List next priorities.'),
      core('asks', 'ask', 'punch', 'Decisions needed', 'State the decisions needed.', true),
      close,
    ],
  },
  {
    id: 'launch',
    label: 'Product launch',
    cues: ['launch', 'release', 'go to market'],
    slides: [
      title,
      core('audience', 'problem', 'idea', 'Who this is for', 'Define the intended audience.'),
      core('need', 'problem', 'story', 'The need', 'Describe the verified user need.'),
      core('promise', 'solution', 'punch', 'The promise', 'State the product promise.'),
      core('experience', 'demo', 'story', 'The experience', 'Show the core user journey.'),
      core('proof', 'metrics', 'punch', 'Proof', 'Add sourced validation.', true),
      core('plan', 'roadmap', 'diagram', 'Launch plan', 'Sequence launch work.'),
      core('risks', 'risks', 'idea', 'Risks', 'Identify launch risks.'),
      core('next', 'ask', 'punch', 'Next steps', 'Name owners and next actions.'),
      close,
    ],
  },
  {
    id: 'status',
    label: 'Project status',
    cues: ['status', 'project update', 'weekly update'],
    slides: [
      title,
      core('summary', 'hook', 'punch', 'Status at a glance', 'State overall status and date.'),
      core('progress', 'roadmap', 'diagram', 'Progress', 'Show completed and active work.'),
      core('evidence', 'metrics', 'punch', 'Measures', 'Add current, sourced measures.', true),
      core('risks', 'risks', 'idea', 'Risks and blockers', 'Explain the effect and response.'),
      core('decisions', 'ask', 'punch', 'Decisions needed', 'List decisions and due dates.'),
      core('next', 'roadmap', 'diagram', 'Next period', 'Name upcoming milestones.'),
      close,
    ],
  },
  {
    id: 'training',
    label: 'Training',
    cues: ['training', 'workshop', 'enablement'],
    slides: [
      title,
      core('objectives', 'agenda', 'idea', 'Learning objectives', 'List observable outcomes.'),
      core('context', 'problem', 'story', 'Why this matters', 'Connect the topic to a task.'),
      core('concept', 'solution', 'idea', 'Core concept', 'Explain one key idea.'),
      core('demo', 'demo', 'story', 'Demonstration', 'Show the method in context.'),
      core('practice', 'steps', 'diagram', 'Practice', 'Give a guided activity.'),
      core(
        'check',
        'quiz',
        'punch',
        'Check understanding',
        'Add a question and expected reasoning.'
      ),
      core('resources', 'findings', 'idea', 'Resources', 'Link trusted follow-up material.'),
      close,
    ],
  },
  {
    id: 'lesson',
    label: 'Lesson',
    cues: ['lesson', 'teach', 'class'],
    slides: [
      title,
      core(
        'question',
        'hook',
        'punch',
        'Opening question',
        'Ask a question that frames the topic.'
      ),
      core('goals', 'agenda', 'idea', 'Goals', 'State what learners can do.'),
      core('idea', 'solution', 'idea', 'Main idea', 'Explain the central concept.'),
      core('example', 'demo', 'story', 'Worked example', 'Walk through a representative case.'),
      core('practice', 'steps', 'diagram', 'Try it', 'Provide a practice sequence.'),
      core('recap', 'findings', 'idea', 'Recap', 'Summarize the core points.'),
      close,
    ],
  },
  {
    id: 'report',
    label: 'Report',
    cues: ['report', 'findings', 'research'],
    slides: [
      title,
      core('question', 'hook', 'punch', 'Question', 'State the question this report answers.'),
      core('method', 'steps', 'diagram', 'Method', 'Describe the method and limits.'),
      core('findings', 'findings', 'idea', 'Findings', 'Present evidence with sources.'),
      core('detail', 'chart', 'diagram', 'Evidence', 'Visualize verified data.', true),
      core(
        'implications',
        'solution',
        'idea',
        'Implications',
        'Explain what the evidence supports.'
      ),
      core(
        'limitations',
        'risks',
        'idea',
        'Limitations',
        'State uncertainty and missing evidence.'
      ),
      core(
        'recommendations',
        'recommendations',
        'diagram',
        'Recommendations',
        'Connect actions to findings.'
      ),
      close,
    ],
  },
  {
    id: 'talk',
    label: 'Talk',
    cues: ['talk', 'keynote', 'presentation'],
    slides: [
      title,
      core('hook', 'hook', 'punch', 'A question to carry', 'Open with a question or observation.'),
      core('story', 'demo', 'story', 'A concrete story', 'Tell one sourced or personal story.'),
      core('idea', 'solution', 'idea', 'The idea', 'Explain the central insight.'),
      core('evidence', 'metrics', 'punch', 'Evidence', 'Show supporting evidence.', true),
      core('practice', 'steps', 'diagram', 'What to try', 'Offer a practical next step.'),
      core('recap', 'findings', 'idea', 'Takeaways', 'Repeat the memorable points.'),
      close,
    ],
  },
]);

export interface GenerateBriefOptions {
  brief: string;
  title?: string;
  outline?: DeckOutlineId;
  locale?: string;
}
export interface GeneratedDeck {
  deck: Deck;
  outline: DeckOutlineId;
  selection: ReturnType<typeof selectDeckLayouts>;
}

/** Build an honest, reproducible draft from a brief; missing evidence stays explicit. */
export function generateDeckFromBrief(options: GenerateBriefOptions): GeneratedDeck {
  const brief = options.brief.slice(0, 5_000).trim();
  const outline = options.outline ?? detectOutline(brief);
  const template = DECK_OUTLINES.find((item) => item.id === outline);
  if (!template) throw new TypeError(`Unknown deck outline "${outline}".`);
  const slides = template.slides.filter((item) => !item.optional);
  const requests: LayoutRequest[] = slides.map((item) => ({
    id: `slide-${item.key}`,
    role: item.role,
    pacing: item.pacing,
    purpose: item.purpose,
  }));
  const selection = selectDeckLayouts(requests);
  const deckSlides = slides.map((item, index) => {
    const chosen = selection[index];
    if (!chosen) throw new TypeError(`No layout was selected for slide ${item.key}.`);
    const note = `Draft guidance: ${item.purpose} Add only verified details from the brief or cited sources.`;
    if (chosen.layout === 'free')
      return {
        id: chosen.id,
        title: item.title || options.title || template.label,
        notes: note,
        layout: 'free',
        blocks: [{ type: 'text', markdown: `Draft: ${item.purpose}` }],
      };
    const props = draftProps(structuredClone(DECK_LAYOUTS[chosen.layout].sample)) as Record<
      string,
      unknown
    >;
    if ('title' in props) props.title = item.title || `Draft: ${item.purpose}`;
    if ('label' in props) props.label = item.title || `Draft: ${item.purpose}`;
    return {
      id: chosen.id,
      title: item.title || options.title || template.label,
      notes: note,
      layout: chosen.layout,
      props,
    };
  });
  const parsed = parseDeck({
    formatVersion: 2,
    meta: {
      title: options.title?.trim() || titleFromBrief(brief) || template.label,
      ...(options.locale ? { locale: options.locale } : {}),
    },
    slides: deckSlides,
  });
  if (!parsed.ok || !parsed.deck)
    throw new TypeError(
      `Generated ${outline} outline failed validation: ${parsed.issues.map((issue) => issue.message).join('; ')}`
    );
  return { deck: parsed.deck, outline, selection };
}

function detectOutline(brief: string): DeckOutlineId {
  const normalized = brief
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  for (const item of DECK_OUTLINES)
    if (item.cues.some((cue) => ` ${normalized} `.includes(` ${cue} `))) return item.id;
  return 'talk';
}
function titleFromBrief(brief: string): string | undefined {
  return (
    brief
      .split(/[.!?\n]/u)[0]
      ?.trim()
      .slice(0, 80) || undefined
  );
}

const STRUCTURAL_KEYS = new Set([
  'avatar',
  'icon',
  'lang',
  'kind',
  'type',
  'id',
  'height',
  'overlay',
  'gradient',
  'pattern',
  'token',
  'muted',
  'autoplay',
  'loop',
  'showTable',
  'width',
]);
function draftProps(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return value.map((item) => draftProps(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [childKey, draftProps(child, childKey)])
    );
  }
  if (typeof value === 'string') {
    if (key === 'src') return 'https://example.com/media/draft-placeholder.webp';
    if (key === 'href') return 'https://example.com/';
    if (key === 'alt') return 'Draft image placeholder.';
    return STRUCTURAL_KEYS.has(key) ? value : 'Draft: add verified details.';
  }
  if (typeof value === 'number') return STRUCTURAL_KEYS.has(key) ? value : 0;
  return value;
}
