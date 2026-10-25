/**
 * Browser side: scenario components report the events a primitive emits
 * (`onOpenChange`, `onValueChange`…) here, and the harness reads the log with
 * `behaviorEvents(page)`. Events are observable behavior; DOM shape is not.
 */
export interface BehaviorEvent {
  name: string;
  detail?: unknown;
}

declare global {
  interface Window {
    __behaviorEvents?: BehaviorEvent[];
  }
}

export function behaviorEvent(name: string, detail?: unknown): void {
  if (typeof window === 'undefined') return;
  window.__behaviorEvents ??= [];
  window.__behaviorEvents.push(detail === undefined ? { name } : { name, detail });
}
