import { getContext, setContext } from 'svelte';
import type { FieldRules } from '../actions.ts';

const FORM = Symbol('tx-player-action-form');

/** A field as its form sees it at submit time. */
export interface RegisteredField {
  name: string;
  state: string;
  rules: FieldRules;
  /** Show or clear this field's error. */
  setError(message: string | null): void;
  focus(): void;
}

export interface ActionFormContext {
  register(field: RegisteredField): () => void;
  pending(): boolean;
}

export function setActionFormContext(context: ActionFormContext): void {
  setContext(FORM, context);
}

export function getActionFormContext(): ActionFormContext | null {
  return getContext<ActionFormContext | undefined>(FORM) ?? null;
}
