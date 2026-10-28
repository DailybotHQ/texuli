/**
 * Catalog manifests for `@texuli/chat` (spec 0.3.0): the display-only thread
 * and message (adopted from the player-held manifests, painted through the
 * package's `CHAT_DISPLAY_LOADERS`). The composer is host chrome (player
 * design §8): a blueprint never supplies one, so it has no manifest.
 * Build-time only; a subpath group the catalog root does not re-export.
 */
import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest } from '../../manifest/types.ts';
import type { GrammarComponentMeta } from '../../render/grammar/types.ts';

const PKG = '@texuli/chat';

export const CHAT_MESSAGE_ROLES = ['user', 'agent', 'system'] as const;

export const chatThreadManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'chat-thread',
  package: PKG,
  label: 'Chat thread',
  summary: 'Read-only conversation transcript of chat-message nodes, without a composer.',
  tier: 'content',
  agentEmittable: true,
  useWhen: [
    'Show a conversation an agent summarized or quoted',
    'Show a chat transcript inside a report or document',
  ],
  dontUseWhen: [
    'The person needs to reply: the host renders its own composer (host chrome)',
    'The content is not a conversation; use text blocks',
  ],
  a11y: [
    'Renders a labelled section; each message is an article with author and time',
    'Static: no live region, focus trap or keyboard handling is added',
  ],
  props: [
    { name: 'label', kind: 'string', trust: 'untrusted', description: 'Accessible name.' },
    { name: 'children', kind: 'slot', description: 'chat-message nodes.' },
  ],
  examples: [{ id: 'standup', title: 'Stand-up excerpt', props: { label: 'Stand-up thread' } }],
  related: ['chat-message'],
});

export const chatMessageManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'chat-message',
  package: PKG,
  label: 'Chat message',
  summary: 'One display-only chat message: author, role, time, text and block children.',
  tier: 'content',
  agentEmittable: true,
  useWhen: ['Inside chat-thread, one per message'],
  dontUseWhen: ['Outside a chat-thread', 'For a reply box; that is host chrome'],
  a11y: [
    'Renders an article named by author and time; the role is visible text',
    'Message text is plain text nodes; links pass the untrusted URL policy',
  ],
  props: [
    { name: 'author', kind: 'string', required: true, trust: 'untrusted' },
    { name: 'role', kind: 'enum', required: true, enumValues: CHAT_MESSAGE_ROLES },
    { name: 'at', kind: 'string', description: 'ISO 8601 time; omitted when it does not parse.' },
    { name: 'text', kind: 'string', trust: 'untrusted', description: 'Chat inline subset.' },
    { name: 'children', kind: 'slot', description: 'blocks-* nodes.' },
  ],
  examples: [
    {
      id: 'agent-reply',
      title: 'Agent reply',
      props: {
        author: 'Fictional Agent',
        role: 'agent',
        at: '2026-10-24T09:00:00Z',
        text: 'Two items are **blocked**.',
      },
    },
  ],
  related: ['chat-thread'],
});

export const CHAT_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze([
  chatThreadManifest,
  chatMessageManifest,
]);

export const CHAT_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = /* @__PURE__ */ Object.freeze([
  { id: 'chat-thread', role: 'container' },
  { id: 'chat-message', role: 'container' },
]);
