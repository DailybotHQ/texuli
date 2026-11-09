/**
 * Canonical JSON and a synchronous SHA-256 for design-system hashes
 * (ADR-021). They live in `@texuli/spec/design-system` since ADR-032 (the
 * content hash needs them without the compiler); re-exported here so the
 * `@texuli/tokens` API is unchanged.
 */
export { canonicalJson, sha256Hex } from '@texuli/spec/design-system';
