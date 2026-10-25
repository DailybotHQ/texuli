import type { Component } from 'svelte';

/**
 * Metadata every registered example carries. The fixture app, visual suite,
 * a11y sweep and website all read the same fields.
 */
export interface ExampleMeta {
  /** Stable kebab-case id used in URLs (`?fixture=<id>`). */
  id: string;
  /** Short human title for lists and gallery cards. */
  title: string;
  /** One or two sentences; fictional data only. */
  description: string;
  /** Search and filter tags (lowerCamelCase or kebab tokens). */
  tags: readonly string[];
  /**
   * What this example demonstrates: `package/export` or `package/Component`
   * (for example `core/safeHref` or `texuli/Button`).
   */
  component: string;
  /** Optional prop or axis names this example exercises. */
  props?: readonly string[];
}

/** Lazy Svelte module shape returned by an example loader. */
export interface ExampleModule {
  default: Component;
}

/**
 * A full registry entry: metadata plus a dynamic import of the Svelte file.
 * Loaders stay lazy so the website and visual suite only pull what they open.
 */
export interface ExampleEntry extends ExampleMeta {
  load: () => Promise<ExampleModule>;
}

/** Optional filters for {@link listExamples}. */
export interface ExampleFilter {
  /** Keep entries that include this tag (exact match). */
  tag?: string;
  /** Keep entries whose `component` equals or starts with this value. */
  component?: string;
}
