/**
 * Code family meta without loaders (Svelte-free).
 * Full tokenizer stays on `@texuli/blocks/code/tokenizer` (`./engine.ts`).
 */
import type { Snippet } from 'svelte';
import type { CodeBlock, FieldIssue } from '../core/index.ts';
import type { HighlightStep } from './highlight.ts';
import type { CodeBlockLabelOverrides } from './labels.ts';

export const CODE_BLOCK_TYPES = ['code'] as const;
export type CodeFamilyBlockType = (typeof CODE_BLOCK_TYPES)[number];
export type CodeFamilyBlock = CodeBlock;

export function isCodeFamilyBlock(block: { type: string }): block is CodeFamilyBlock {
  return (CODE_BLOCK_TYPES as readonly string[]).includes(block.type);
}

/** What the code block's bar shows, handed to the `header` and `toolbar` snippets. */
export interface CodeBlockBarContext {
  /** The block's name: its filename, its language in capitals, or the `code` label. */
  name: string;
  filename: string | undefined;
  /** The language as written in the block (`ts`), if any. */
  lang: string | undefined;
  /** The code text (what the copy button copies). */
  code: string;
  /** Copies the code with the built-in status and announcement. */
  copy: () => Promise<void>;
  copyStatus: 'idle' | 'copying' | 'copied' | 'failed';
}

export interface CodeBlockViewProps {
  block: unknown;
  labels?: CodeBlockLabelOverrides;
  oninvalid?: (issues: FieldIssue[]) => void;
  lineNumbers?: boolean;
  highlights?: readonly HighlightStep[];
  hostStep?: number;
  step?: number;
  copyable?: boolean;
  /**
   * Replaces the visible name at the start of the bar (a language badge, a
   * filename with an icon, tabs). The name stays the code region's
   * accessible name.
   */
  header?: Snippet<[CodeBlockBarContext]>;
  /** Extra actions at the end of the bar, before the copy button. */
  toolbar?: Snippet<[CodeBlockBarContext]>;
}
