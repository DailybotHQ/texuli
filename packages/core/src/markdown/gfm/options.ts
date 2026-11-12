/**
 * GitHub Flavored Markdown 0.29 extensions (ADR-034): tables, task list items, strikethrough,
 * extended autolinks and footnotes. `parseMarkdown` turns all of them on by default; `gfm: false`
 * reads strict CommonMark 0.31.2, and an object turns single extensions off. The tag filter is
 * not an extension here: raw HTML never renders as markup (writers escape or drop it).
 */

export interface GfmOptions {
  /** Pipe tables (default on). */
  readonly table?: boolean;
  /** `[ ]` and `[x]` task list items (default on). */
  readonly taskList?: boolean;
  /** `~one~` and `~~two~~` strikethrough (default on). */
  readonly strikethrough?: boolean;
  /** `www.`, `http(s)://`, `ftp://`, email, `mailto:` and `xmpp:` autolinks without `<>` (default on). */
  readonly autolink?: boolean;
  /** `[^label]` references and `[^label]:` definitions (default on). */
  readonly footnote?: boolean;
}

export interface GfmFlags {
  readonly table: boolean;
  readonly taskList: boolean;
  readonly strikethrough: boolean;
  readonly autolink: boolean;
  readonly footnote: boolean;
}

export const GFM_OFF: GfmFlags = Object.freeze({
  table: false,
  taskList: false,
  strikethrough: false,
  autolink: false,
  footnote: false,
});

/** Resolve the `gfm` option: `undefined` and `true` turn every extension on, `false` none. */
export function gfmFlags(option: boolean | GfmOptions | undefined): GfmFlags {
  if (option === false) return GFM_OFF;
  const set = option !== null && typeof option === 'object' ? option : {};
  const on = (value: unknown) => value !== false;
  return {
    table: on(set.table),
    taskList: on(set.taskList),
    strikethrough: on(set.strikethrough),
    autolink: on(set.autolink),
    footnote: on(set.footnote),
  };
}
