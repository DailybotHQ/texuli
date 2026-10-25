import type { ChatAuthor, ChatMessage, ChatMessageStatus } from './types.ts';

/** Longest body a streamed message may grow to; later text is dropped. */
export const MAX_STREAM_BODY = 64_000;

/** One event of an agent's streamed reply. Plain text only, never markup or HTML. */
export type ChatStreamEvent =
  | { type: 'start'; id: string; author: ChatAuthor; at: ChatMessage['at']; body?: string }
  | { type: 'delta'; id: string; text: string }
  /** `body`, when present, is the authoritative final text and replaces the streamed one. */
  | { type: 'end'; id: string; body?: string; status?: ChatMessageStatus }
  | { type: 'error'; id: string };

const STATUSES: readonly ChatMessageStatus[] = ['sending', 'sent', 'delivered', 'read', 'failed'];

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAuthor(value: unknown): value is ChatAuthor {
  return (
    isBag(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.avatarUrl === undefined || typeof value.avatarUrl === 'string')
  );
}

function isAt(value: unknown): value is ChatMessage['at'] {
  return value instanceof Date || typeof value === 'string' || typeof value === 'number';
}

function cap(value: string): string {
  return value.length > MAX_STREAM_BODY ? value.slice(0, MAX_STREAM_BODY) : value;
}

/**
 * Apply one stream event to a message list, immutably. Events usually come
 * off the network, so they are checked: a malformed event, a `start` for an
 * id that exists, or a `delta`/`end`/`error` for a message that is not
 * streaming returns the same array unchanged.
 */
export function applyChatStreamEvent(
  messages: readonly ChatMessage[],
  event: unknown
): ChatMessage[] {
  const same = messages as ChatMessage[];
  if (!isBag(event) || typeof event.id !== 'string' || event.id === '') return same;
  const { id } = event;
  const index = messages.findIndex((message) => message.id === id);

  if (event.type === 'start') {
    if (index >= 0 || !isAuthor(event.author) || !isAt(event.at)) return same;
    const author: ChatAuthor = {
      id: event.author.id,
      name: event.author.name,
      ...(event.author.avatarUrl ? { avatarUrl: event.author.avatarUrl } : {}),
    };
    const body = typeof event.body === 'string' ? cap(event.body) : '';
    return [...messages, { id, author, at: event.at, body, streaming: true }];
  }

  const current = messages[index];
  if (!current?.streaming) return same;
  let next: ChatMessage | null = null;
  if (event.type === 'delta' && typeof event.text === 'string') {
    if (event.text === '' || current.body.length >= MAX_STREAM_BODY) return same;
    next = { ...current, body: cap(current.body + event.text) };
  } else if (event.type === 'end') {
    const status = STATUSES.find((value) => value === event.status);
    next = {
      ...current,
      body: typeof event.body === 'string' ? cap(event.body) : current.body,
      streaming: false,
      ...(status ? { status } : {}),
    };
  } else if (event.type === 'error') {
    next = { ...current, streaming: false, status: 'failed' };
  }
  if (!next) return same;
  const out = messages.slice();
  out[index] = next;
  return out;
}
