import type { JsonSchema, SchemaIssue } from './schema.ts';

/**
 * Where an operation can run:
 * - `edge`: pure compute, runs anywhere (local MCP, CLI, the remote endpoint);
 * - `node`: needs Node (the file system, the PDF and DOCX writers, local writes);
 * - `site`: remote only, reads the built texuli.com through the door's
 *   assets binding (`site.pages`, `site.read`, `site.search`; ADR-018).
 */
export type OperationRuntime = 'edge' | 'node' | 'site';

/** The runtime classes the local doors (stdio MCP, CLI) serve. */
export const LOCAL_RUNTIMES: readonly OperationRuntime[] = Object.freeze(['edge', 'node']);
/** The runtime classes the remote door (`https://texuli.com/mcp`) serves. */
export const REMOTE_RUNTIMES: readonly OperationRuntime[] = Object.freeze(['edge', 'site']);

/**
 * An `env.ASSETS`-shaped reader of the built site: one request in, the
 * static file (or a 404) out. Never a network fetch.
 */
export interface SiteAssets {
  fetch(request: Request): Promise<Response>;
}

/** What a door that serves `site` operations passes them. */
export interface SiteContext {
  assets: SiteAssets;
  /** The origin page URLs are reported under (default `https://texuli.com`). */
  origin?: string;
}

/** A local writer `node` operations that save files use (`ds.save`): the local write policy. */
export interface LocalFiles {
  /** Check `path` under the same policy without writing: the path relative to the working directory, or a refusal. */
  check(path: string): { ok: true; relative: string } | { ok: false; code: string; error: string };
  /**
   * Write text to an explicit path inside the door's working directory
   * (ADR-019): traversal, symlinks and an existing file without
   * `overwrite` are refused with a stable code.
   */
  write(
    path: string,
    data: string,
    options: { overwrite: boolean }
  ): Promise<
    { ok: true; relative: string; bytes: number } | { ok: false; code: string; error: string }
  >;
}

/** Behavior hints every door publishes (MCP maps them to `*Hint` annotations). */
export interface OperationAnnotations {
  /** Changes nothing outside its own output. */
  readOnly: boolean;
  /** May delete or overwrite data. */
  destructive: boolean;
  /** The same input always gives the same output. */
  idempotent: boolean;
  /** Reaches outside Texuli (network, user files). */
  openWorld: boolean;
}

/** Caps an operation states and `invoke()` enforces. */
export interface OperationLimits {
  /** The UTF-8 size of the JSON input, at most. */
  inputBytes: number;
  /** The largest list the operation accepts or returns (results, patch operations, manifests). */
  items?: number;
  /** The wall-clock budget, checked whenever the handler yields. */
  timeMs: number;
}

/** A worked example: valid input an agent can copy. Tests invoke every one. */
export interface OperationExample {
  title: string;
  input: Record<string, unknown>;
}

/** What a handler receives besides its input. */
export interface OperationContext {
  /** Aborted when the time budget runs out. */
  signal: AbortSignal;
  /** The built site, when the door serves `site` operations. */
  site?: SiteContext;
  /** The local writer, when the door writes files (the stdio MCP and the CLI pass it). */
  files?: LocalFiles;
}

/** One agent-facing capability, declared once and served by every door. */
export interface Operation {
  /** `group.verb`, e.g. `catalog.search`. */
  name: string;
  title: string;
  /** One or two sentences an agent reads to pick the operation; names what it returns. */
  summary: string;
  /** JSON Schema of the input (always an object). */
  input: JsonSchema;
  /** JSON Schema of the output (always an object). */
  output: JsonSchema;
  annotations: OperationAnnotations;
  runtime: OperationRuntime;
  limits: OperationLimits;
  examples: readonly OperationExample[];
  /** Receives input that already passed `input`; its result must pass `output`. */
  handler: (input: Record<string, unknown>, context: OperationContext) => unknown;
}

/**
 * A 0.8 MCP tool name kept for one minor. `targets` lists the operations it
 * can reach; `route` maps its input to one of them (default: the first,
 * input unchanged). `input` is the legacy schema when it differs.
 */
export interface OperationAlias {
  name: string;
  targets: readonly string[];
  /** The release that removes the alias. */
  removeIn: string;
  input?: JsonSchema;
  route?: (input: Record<string, unknown>) => { name: string; input: Record<string, unknown> };
}

/** Stable error codes `invoke()` returns. */
export const OPERATION_ERROR_CODES = [
  'unknown-operation',
  'invalid-input',
  'input-too-large',
  'not-found',
  'runtime-unavailable',
  'invalid-output',
  'timeout',
  'operation-failed',
] as const;
export type OperationErrorCode = (typeof OPERATION_ERROR_CODES)[number];

/** A refusal a handler throws on purpose, with a stable code. */
export class OperationError extends Error {
  readonly code: OperationErrorCode;
  constructor(code: OperationErrorCode, message: string) {
    super(message);
    this.name = 'OperationError';
    this.code = code;
  }
}

export interface InvokeFailure {
  ok: false;
  /** The resolved operation, when the name was known. */
  operation?: string;
  error: { code: OperationErrorCode; message: string; issues?: SchemaIssue[] };
}

export type InvokeResult = { ok: true; operation: string; output: unknown } | InvokeFailure;

export interface InvokeOptions {
  /** The runtime classes the calling door serves (default: all). */
  runtimes?: readonly OperationRuntime[];
  /** The built site `site` operations read (the remote door passes `env.ASSETS`). */
  site?: SiteContext;
  /** The local writer `ds.save` uses; only the local doors pass it. */
  files?: LocalFiles;
}
