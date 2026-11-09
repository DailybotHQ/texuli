/**
 * Catalog manifests for `@texuli/chat` (spec 0.3.0): the display-only thread
 * and message (adopted from the player-held manifests, painted through the
 * package's `CHAT_DISPLAY_LOADERS`). The composer is host chrome (player
 * design §8): agents never emit it (`agentEmittable: false`); the allow set
 * still governs it.
 * Build-time only; a subpath group the catalog root does not re-export.
 */
import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest } from '../../manifest/types.ts';
import type { GrammarComponentMeta } from '../../render/grammar/types.ts';
import { stampChatAxes } from './axes.ts';

const PKG = '@texuli/chat';

/* @__NO_SIDE_EFFECTS__ */
function defineChatManifest(input: CatalogManifest): Readonly<CatalogManifest> {
  return stampChatAxes(manifestData(input));
}

export const CHAT_MESSAGE_ROLES = ['user', 'agent', 'system'] as const;

export const chatThreadManifest: CatalogManifest = /* @__PURE__ */ defineChatManifest({
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

export const chatMessageManifest: CatalogManifest = /* @__PURE__ */ defineChatManifest({
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

export const composerManifest: CatalogManifest = /* @__PURE__ */ defineChatManifest({
  id: 'composer',
  package: PKG,
  label: 'Composer',
  summary: 'The host reply box for a chat thread. Host chrome; agents never emit it.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['The person replies in a live chat the host owns'],
  dontUseWhen: [
    'A read-only transcript (use chat-thread)',
    'A form (use action-form or schema-form)',
  ],
  a11y: [
    'The field is labelled; Enter sends and Escape stops a stream',
    'Pending send is announced; the send control stays named while streaming',
  ],
  props: [
    { name: 'value', kind: 'string', trust: 'untrusted', description: 'Draft text.' },
    { name: 'onSubmit', kind: 'event', required: true, description: 'Send the draft.' },
    { name: 'disabled', kind: 'boolean', default: false },
    { name: 'sending', kind: 'boolean', default: false },
    { name: 'maxRows', kind: 'number', default: 6 },
    { name: 'maxLength', kind: 'number' },
    { name: 'streaming', kind: 'boolean', default: false },
    { name: 'onStop', kind: 'event', description: 'Stop a streaming reply.' },
    { name: 'layout', kind: 'enum', enumValues: ['stack', 'row'], default: 'stack' },
    { name: 'sendButton', kind: 'enum', enumValues: ['label', 'icon'], default: 'label' },
    { name: 'class', kind: 'string' },
  ],
  examples: [{ id: 'reply', title: 'Reply box', props: { layout: 'stack' } }],
  related: ['chat-thread', 'chat-message'],
  events: ['submit'],
});

export const CHAT_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze([
  chatMessageManifest,
  chatThreadManifest,
  composerManifest,
]);

export const CHAT_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = /* @__PURE__ */ Object.freeze([
  { id: 'chat-thread', role: 'container' },
  { id: 'chat-message', role: 'container' },
  { id: 'composer', role: 'interactive' },
]);
