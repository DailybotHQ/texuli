/**
 * The checks the deck editor runs before anything paints, both at the
 * `untrusted` tier and through the engine only (`@texuli/deck`):
 *
 * - JSON: `loadUntrustedDeck` (byte, depth and node bounds, plain-data copy,
 *   migration, `parseDeck`, block bodies by the stage's `validateDeckBlock`). Syntax errors carry their line and column; every
 *   model issue gets one too, by locating its JSON path in the text with the
 *   engine's bounded JSON reader.
 * - Markdown: `parseDeckMarkdown`, whose issues carry their source line and
 *   column already.
 *
 * Loaded lazily by the island (with the stage), so the first paint is the shell.
 */
import { parseDeckMarkdown, readJson, writeDeckMarkdown } from '@texuli/deck/markdown';
import { type Deck, lineColumn, loadUntrustedDeck } from '@texuli/deck/model';
import { validateDeckBlock } from '@texuli/slides/stage';
import { type DeckCheck, type EngineDiagnostic, toEditorDiagnostics } from './model.ts';

/** `$.slides[2].props.title` → `$.slides[2].props` → … → `$`. */
function parentPath(path: string): string | undefined {
  if (path === '$') return undefined;
  const dot = path.lastIndexOf('.');
  const bracket = path.lastIndexOf('[');
  const cut = Math.max(dot, bracket);
  return cut <= 0 ? '$' : path.slice(0, cut);
}

/** A locator from JSON paths to positions in `text` (nearest recorded ancestor). */
export function jsonLocator(
  text: string
): (jsonPath: string) => { line: number; column: number } | undefined {
  const read = readJson(text, { nodes: 200_000, maxLength: 1_100_000, maxDepth: 64 });
  if (!read.ok) return () => undefined;
  const offsets = read.offsets;
  return (jsonPath) => {
    for (
      let path: string | undefined = jsonPath || '$';
      path !== undefined;
      path = parentPath(path)
    ) {
      const offset = offsets.get(path);
      if (offset !== undefined) return lineColumn(text, offset);
    }
    return undefined;
  };
}

/** Check deck JSON text. */
export function checkDeckJson(text: string): DeckCheck {
  // Block bodies get the stage's own check; components and layouts are checked
  // again by the stage itself, which reports a refusal through `onError`.
  const result = loadUntrustedDeck(text, { validateBlock: validateDeckBlock });
  const locate = result.issues.some((issue) => issue.source === undefined)
    ? jsonLocator(text)
    : undefined;
  const diagnostics = toEditorDiagnostics(result.issues as readonly EngineDiagnostic[], locate);
  return result.ok && result.deck
    ? { ok: true, deck: result.deck, diagnostics }
    : { ok: false, diagnostics };
}

/** Check deck Markdown text. */
export function checkDeckMarkdown(text: string): DeckCheck {
  const result = parseDeckMarkdown(text, { validateBlock: validateDeckBlock });
  const diagnostics = toEditorDiagnostics(result.issues as readonly EngineDiagnostic[]);
  return result.ok && result.deck
    ? { ok: true, deck: result.deck, diagnostics }
    : { ok: false, diagnostics };
}

/** A validated deck as deck Markdown (Convert, JSON → Markdown). */
export function deckAsMarkdown(deck: unknown): { markdown: string; warnings: string[] } {
  const written = writeDeckMarkdown(deck as Deck);
  return { markdown: written.markdown, warnings: written.issues.map((issue) => issue.message) };
}

/** A validated deck as formatted JSON (Convert, Markdown → JSON). */
export function deckAsJson(deck: unknown): string {
  return `${JSON.stringify(deck, null, 2)}\n`;
}
