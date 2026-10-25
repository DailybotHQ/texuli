/** State values used by primitive root and trigger data attributes. */
export type PrimitiveState =
  | 'active'
  | 'checked'
  | 'closed'
  | 'complete'
  | 'disabled'
  | 'error'
  | 'hidden'
  | 'inactive'
  | 'indeterminate'
  | 'loaded'
  | 'loading'
  | 'open'
  | 'unchecked';

/** Return consistent `data-state` and `data-disabled` attributes for a primitive. */
export function stateAttributes(
  state: PrimitiveState,
  disabled = state === 'disabled'
): {
  'data-state': PrimitiveState;
  'data-disabled'?: '';
} {
  return disabled ? { 'data-state': state, 'data-disabled': '' } : { 'data-state': state };
}
