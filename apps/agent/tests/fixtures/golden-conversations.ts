import type { Recording } from '../../src/provider.ts';

const validReport = {
  id: 'layout-doc',
  props: { title: 'Harbor support, week 42' },
  children: [
    { id: 'blocks-text', props: { block: { type: 'text', markdown: 'Response time improved.' } } },
  ],
};

/** Fictional provider transcripts replayed through the full agent service. */
export const GOLDEN_CONVERSATIONS: readonly Recording[] = [
  {
    prompt: 'Draft the fictional Harbor support weekly report.',
    calls: [
      [
        { type: 'text', text: 'A short weekly report for Harbor support.' },
        { type: 'tool', name: 'emit_blueprint', input: { tree: validReport } },
        { type: 'usage', inputTokens: 120, outputTokens: 32 },
      ],
    ],
  },
  {
    prompt: 'Repair the fictional Harbor report after validation.',
    calls: [
      [
        { type: 'text', text: 'First attempt needs a correction.' },
        { type: 'tool', name: 'emit_blueprint', input: { tree: { id: 'marquee' } } },
        { type: 'usage', inputTokens: 90, outputTokens: 20 },
      ],
      [
        { type: 'text', text: 'Corrected to a supported document layout.' },
        { type: 'tool', name: 'emit_blueprint', input: { tree: validReport } },
        { type: 'usage', inputTokens: 110, outputTokens: 28 },
      ],
    ],
  },
];
