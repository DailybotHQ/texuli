// A small fixture entry: some code first paint pays for, and some it does not.
export function greet(name: string): string {
  return `Hello, ${name.trim() || 'friend'}! Welcome to the size fixture.`;
}

/** Loaded on demand: measured as lazy, never against the budget. */
export const loadLater = () => import('./later.ts');
