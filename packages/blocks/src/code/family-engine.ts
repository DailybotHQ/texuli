/**
 * Code family meta without loaders (Svelte-free).
 * Full tokenizer stays on `@texuli/blocks/code/tokenizer` (`./engine.ts`).
 */
import type { CodeBlock, FieldIssue } from '../core/index.ts';
import type { HighlightStep } from './highlight.ts';
import type { CodeBlockLabelOverrides } from './labels.ts';

export const CODE_BLOCK_TYPES = ['code'] as const;
export type CodeFamilyBlockType = (typeof CODE_BLOCK_TYPES)[number];
export type CodeFamilyBlock = CodeBlock;

export function isCodeFamilyBlock(block: { type: string }): block is CodeFamilyBlock {
  return (CODE_BLOCK_TYPES as readonly string[]).includes(block.type);
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
}
