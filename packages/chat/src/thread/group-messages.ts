import type { ChatMessage, MessageGroup } from './types.ts';

function toDate(value: ChatMessage['at']): Date | null {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/** Group adjacent messages from the same author when they are at most five minutes apart. */
export function groupMessages(
  messages: readonly ChatMessage[],
  windowMs = 5 * 60_000
): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let previous: { authorId: string; at: Date | null } | undefined;

  for (const message of messages) {
    const at = toDate(message.at);
    const previousAt = previous?.at;
    const isNewDay =
      at !== null &&
      (previousAt === null || previousAt === undefined || !sameLocalDay(previousAt, at));
    const last = groups[groups.length - 1];
    const continues =
      last !== undefined &&
      !isNewDay &&
      previous?.authorId === message.author.id &&
      at !== null &&
      previousAt !== null &&
      previousAt !== undefined &&
      at.getTime() >= previousAt.getTime() &&
      at.getTime() - previousAt.getTime() <= Math.max(0, windowMs);

    if (continues && last) {
      last.messages.push(message);
    } else {
      groups.push({
        key: message.id,
        author: message.author,
        messages: [message],
        dayStart: isNewDay ? at : null,
      });
    }
    previous = { authorId: message.author.id, at };
  }

  return groups;
}
