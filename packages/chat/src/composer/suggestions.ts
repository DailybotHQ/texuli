import { messageTokens } from '../thread/rich-text.ts';

/** One option of the composer's inline autocomplete list. Plain text only. */
export interface ComposerSuggestion {
  /** Stable key within the list. */
  readonly id: string;
  /** Visible name of the option. */
  readonly label: string;
  /** Second line, for example a command's summary. */
  readonly description?: string;
  /** A short glyph shown before the label (an emoji, an initial); decorative. */
  readonly glyph?: string;
  /** What replaces the trigger and the typed query. */
  readonly insert: string;
}

/**
 * A source of suggestions for one trigger character (`@` people, `/` commands,
 * `:` emoji). `search` may answer synchronously or with a promise; a late
 * answer for an old query is ignored.
 */
export interface ComposerSuggestionSource {
  /** The character that opens this list. */
  readonly trigger: string;
  /** Accessible name of the list ("People", "Commands", "Emoji"). */
  readonly label: string;
  /** Only at the start of the message or of a line (slash commands). */
  readonly lineStart?: boolean;
  /** Shortest query that opens the list (default 0). */
  readonly minQuery?: number;
  /** Longest query read after the trigger (default 32). */
  readonly maxQuery?: number;
  readonly search: (
    query: string
  ) => readonly ComposerSuggestion[] | Promise<readonly ComposerSuggestion[]>;
}

/** Most options a list shows at once. */
export const COMPOSER_MAX_SUGGESTIONS = 8;

/**
 * Items whose `name` starts with the query first, then those containing it
 * (case-insensitive), in their original order, at most `COMPOSER_MAX_SUGGESTIONS`.
 */
export function rankSuggestions<T>(
  items: readonly T[],
  query: string,
  name: (item: T) => string
): T[] {
  const needle = query.toLocaleLowerCase();
  const starts: T[] = [];
  const contains: T[] = [];
  for (const item of items) {
    const text = name(item).toLocaleLowerCase();
    if (text.startsWith(needle)) starts.push(item);
    else if (needle !== '' && text.includes(needle)) contains.push(item);
    if (starts.length >= COMPOSER_MAX_SUGGESTIONS) break;
  }
  return [...starts, ...contains].slice(0, COMPOSER_MAX_SUGGESTIONS);
}

export interface MentionCandidate {
  readonly id: string;
  readonly name: string;
  /** Second line, for example a role. */
  readonly description?: string;
}

/**
 * `@` suggestions from a known list of people or agents. Choosing one inserts
 * the mention token `@[Name](mention:id)` that messages render as a mention.
 */
export function mentionSuggestions(
  people: readonly MentionCandidate[],
  options: { readonly label?: string } = {}
): ComposerSuggestionSource {
  return {
    trigger: '@',
    label: options.label ?? 'People',
    search: (query) =>
      rankSuggestions(people, query, (person) => person.name).flatMap((person) => {
        const insert = messageTokens.mention(person.name, person.id);
        return insert
          ? [
              {
                id: person.id,
                label: person.name,
                glyph: person.name.trim().charAt(0).toLocaleUpperCase(),
                insert,
                ...(person.description ? { description: person.description } : {}),
              },
            ]
          : [];
      }),
  };
}

export interface CommandCandidate {
  /** Command name without the slash: letters, digits, `-` and `_`. */
  readonly name: string;
  readonly description?: string;
}

const COMMAND_NAME = /^[A-Za-z0-9_-]{1,32}$/;

/** `/` suggestions at the start of a line; choosing one inserts `/name`. */
export function commandSuggestions(
  commands: readonly CommandCandidate[],
  options: { readonly label?: string } = {}
): ComposerSuggestionSource {
  const valid = commands.filter((command) => COMMAND_NAME.test(command.name));
  return {
    trigger: '/',
    label: options.label ?? 'Commands',
    lineStart: true,
    search: (query) =>
      rankSuggestions(valid, query, (command) => command.name).map((command) => ({
        id: command.name,
        label: `/${command.name}`,
        insert: `/${command.name}`,
        ...(command.description ? { description: command.description } : {}),
      })),
  };
}
