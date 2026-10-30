import { DECK_COMMANDS, type DeckCommandName, runDeckCommand } from '../deck/index.ts';
import { defineOperation } from './registry.ts';
import type { Operation } from './types.ts';

/** The largest deck Markdown or JSON input, in characters (and bytes, through `limits`). */
export const MAX_SOURCE = 2_000_000;

const EXAMPLE_MARKDOWN =
  '---\ntitle: Fictional deck\nlocale: en\n---\n\n<!-- .slide: layout=title-hero title=Opening -->\n\n# A clear opening\n\nA fictional example\n\n*Example team*\n\nNote: Presenter guidance: introduce the topic and invite questions from the room.\n';

export const deckRun: Operation = defineOperation({
  name: 'deck.run',
  title: 'Run a deck command',
  summary:
    'Inspect, lint and convert a Texuli deck on the shared v2 model: capabilities, the JSON Schema, layouts, lint, inspect, from-markdown and to-markdown. Pure compute; returns { result } with the command output (ok, issues, deck, markdown …).',
  input: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        enum: DECK_COMMANDS,
        description:
          'capabilities, schema and layouts take nothing; lint, inspect and to-markdown take deck; from-markdown takes markdown.',
      },
      deck: {
        type: 'object',
        description: 'A JSON deck (formatVersion 2) for lint, inspect or to-markdown.',
      },
      markdown: {
        type: 'string',
        maxLength: MAX_SOURCE,
        description: 'Deck Markdown (front matter, one section per slide) for from-markdown.',
      },
    },
    required: ['command'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: { result: { type: 'object' } },
    required: ['result'],
  },
  annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
  runtime: 'edge',
  limits: { inputBytes: MAX_SOURCE + 100_000, timeMs: 10_000 },
  examples: [
    { title: 'What the deck format supports', input: { command: 'capabilities' } },
    {
      title: 'Import deck Markdown',
      input: { command: 'from-markdown', markdown: EXAMPLE_MARKDOWN },
    },
  ],
  handler(input) {
    return {
      result: runDeckCommand(input.command as DeckCommandName, {
        ...(Object.hasOwn(input, 'deck') ? { deck: input.deck } : {}),
        ...(typeof input.markdown === 'string' ? { markdown: input.markdown } : {}),
      }),
    };
  },
});
