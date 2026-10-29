/**
 * `@texuli/spec/stream` — streamed blueprints (ADR-014): an incremental JSON
 * tokenizer with a byte budget and a depth cap, the partial-blueprint
 * assembler that reports when each node's shell is final, and a push handle
 * hosts write chunks into. Framework-free: no DOM, no Svelte, no Node APIs.
 * Nothing here validates a node; `@texuli/catalog/validate`
 * (`validateStreamNode`, then `validateDraft`) does.
 */

export {
  type BlueprintAssembler,
  type BlueprintAssemblerOptions,
  type BlueprintStreamEvent,
  createBlueprintAssembler,
  STREAM_NODE_ORDER,
  type StreamNodeShell,
} from './assembler.ts';
export {
  BlueprintStreamAbortError,
  type BlueprintStreamHandle,
  createBlueprintStream,
} from './source.ts';
export {
  createJsonTokenizer,
  DEFAULT_STREAM_MAX_BYTES,
  DEFAULT_STREAM_MAX_DEPTH,
  type JsonScalar,
  type JsonStreamEvent,
  type JsonTokenizer,
  type JsonTokenizerOptions,
  STREAM_PROTOTYPE_KEYS,
  type StreamError,
  type StreamErrorCode,
} from './tokenizer.ts';
