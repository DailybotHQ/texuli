import type { DeckPlayerHost } from '@texuli/player';
import { getContext, setContext } from 'svelte';
import type { MotionProp } from 'texuli/motion';
import type { EmbedResolver } from '../shared/embeds.ts';
import type { MediaResolver } from '../shared/media.ts';
import type { PageRef, SlashItem } from './slash.ts';
import type { PagesEditor } from './state.svelte.ts';

/** What every row reads from the page editor root. */
export interface PagesEditorContext {
  editor: PagesEditor;
  /** The id of the hidden keyboard help every handle is described by. */
  helpId: string;
  /** The slash menu's items (getter: the content blocks arrive lazily). */
  items: () => readonly SlashItem[];
  readonly: () => boolean;
  motion: () => MotionProp | undefined;
  resolveEmbed?: EmbedResolver;
  resolveMedia?: MediaResolver;
  deckHost?: DeckPlayerHost | null;
  onNavigate?: (ref: string) => void;
  pageHref?: (ref: string) => string | null | undefined;
  createPage?: () => PageRef | null | undefined | Promise<PageRef | null | undefined>;
}

const KEY = Symbol('texuli-pages-editor');

export function setPagesContext(context: PagesEditorContext): PagesEditorContext {
  return setContext(KEY, context);
}

export function getPagesContext(): PagesEditorContext {
  const context = getContext<PagesEditorContext | undefined>(KEY);
  if (!context) throw new Error('A page editor part must sit inside <PageEditor>.');
  return context;
}
