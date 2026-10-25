import type { CatalogManifest } from '@texuli/catalog/manifest';

/** The chat display roles a message may carry. */
export const CHAT_MESSAGE_ROLES = ['user', 'agent', 'system'] as const;

/**
 * `chat-thread`: a read-only conversation transcript (audit G10). Its
 * children are `chat-message` nodes. There is no composer: the composer is
 * host chrome (see `HOST_CHROME_IDS`).
 */
export const chatThreadManifest: CatalogManifest = Object.freeze({
  id: 'chat-thread',
  package: '@texuli/chat',
  label: 'Chat thread',
  summary: 'Read-only conversation transcript of chat-message nodes, without a composer.',
  tier: 'content',
  agentEmittable: true,
  useWhen: Object.freeze([
    'Show a conversation an agent summarized or quoted',
    'Show a chat transcript inside a report or document',
  ]),
  dontUseWhen: Object.freeze([
    'The person needs to reply: the host renders its own live thread and composer',
    'The content is not a conversation; use text blocks',
  ]),
  a11y: Object.freeze([
    'Renders a labelled section; each message is an article with author and time',
    'Static: no live region, focus trap or keyboard handling is added',
  ]),
  props: Object.freeze([
    { name: 'label', kind: 'string', trust: 'untrusted', description: 'Accessible name.' },
    { name: 'children', kind: 'slot', description: 'chat-message nodes.' },
  ]),
  examples: Object.freeze([
    { id: 'standup', title: 'Stand-up excerpt', props: { label: 'Stand-up thread' } },
  ]),
  related: Object.freeze(['chat-message']),
}) as CatalogManifest;

/**
 * `chat-message`: one display-only message. `text` uses the chat inline
 * subset (`parseMessageText` in `@texuli/chat`); children are validated
 * `blocks-*` nodes for richer bodies.
 */
export const chatMessageManifest: CatalogManifest = Object.freeze({
  id: 'chat-message',
  package: '@texuli/chat',
  label: 'Chat message',
  summary: 'One display-only chat message: author, role, time, text and block children.',
  tier: 'content',
  agentEmittable: true,
  useWhen: Object.freeze(['Inside chat-thread, one per message']),
  dontUseWhen: Object.freeze(['Outside a chat-thread', 'For a reply box; that is host chrome']),
  a11y: Object.freeze([
    'Renders an article named by author and time; the role is visible text',
    'Message text is plain text nodes; links pass the untrusted URL policy',
  ]),
  props: Object.freeze([
    { name: 'author', kind: 'string', required: true, trust: 'untrusted' },
    { name: 'role', kind: 'enum', required: true, enumValues: CHAT_MESSAGE_ROLES },
    { name: 'at', kind: 'string', description: 'ISO 8601 time; omitted when it does not parse.' },
    { name: 'text', kind: 'string', trust: 'untrusted', description: 'Chat inline subset.' },
    { name: 'children', kind: 'slot', description: 'blocks-* nodes.' },
  ]),
  examples: Object.freeze([
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
  ]),
  related: Object.freeze(['chat-thread']),
}) as CatalogManifest;

/** The G10 chat display group, until the catalog's own chat group lands. */
export const CHAT_DISPLAY_MANIFESTS: readonly CatalogManifest[] = Object.freeze([
  chatThreadManifest,
  chatMessageManifest,
]);
