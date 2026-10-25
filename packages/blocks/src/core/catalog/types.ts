import type { Block, BlockType } from '../schema/blocks.ts';
import type { BlockFamily } from '../schema/vocabulary.ts';

/**
 * Authoring metadata for one block type (USE WHEN / DON'T USE WHEN / limits /
 * a11y / examples). Agents, MCP and deck lint read this data instead of prose.
 */
export interface BlockCatalogEntry {
  type: BlockType;
  /** Short editor label. */
  label: string;
  family: BlockFamily;
  /** Situations where this block is the right choice. */
  useWhen: readonly string[];
  /** Situations where another block (or none) is better. */
  dontUseWhen: readonly string[];
  /** Human-readable caps from the schema (counts, lengths, nesting). */
  limits: readonly string[];
  /** How the block stays usable with keyboard, screen readers and contrast. */
  a11y: string;
  /** Smallest valid instance (required fields only when possible). */
  exampleMinimal: Block;
  /** Richer valid instance showing common optional fields. */
  exampleRich: Block;
}

export type BlockDiagnosticPath = string | number;

export interface BlockAuthoringDiagnostic {
  code: string;
  path: BlockDiagnosticPath[];
  jsonPath: string;
  message: string;
  hint: string;
}

export interface BlockAuthoringValidation {
  valid: boolean;
  diagnostics: BlockAuthoringDiagnostic[];
}
