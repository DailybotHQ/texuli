/** Project kinds `texuli init` knows how to wire. */
export type Framework = 'vite' | 'astro' | 'sveltekit';

/** `texuli.config.json`, written by `init` and read by `theme apply`. */
export interface TexuliConfig {
  framework: Framework;
  /** The generated stylesheet, relative to the project root. */
  css: string;
  /** The file that imports the stylesheet. */
  entry: string;
  /** The file whose `<html>` carries `data-tx-theme` and the no-flash script. */
  document: string;
  /** Theme id from the Texuli theme library. */
  theme: string;
  /** The appearance cache namespace for the no-flash script. */
  namespace: string;
}

/** What happened (or would happen) to one file. */
export interface FileChange {
  /** Relative to the project root, with forward slashes. */
  path: string;
  action: 'create' | 'update' | 'unchanged';
  bytes: number;
}

export interface CommandResult {
  ok: boolean;
  dryRun: boolean;
  files: FileChange[];
  errors: string[];
  /** Short next steps for the person or agent. */
  notes: string[];
}

export interface InitOptions {
  cwd: string;
  framework?: Framework;
  theme?: string;
  /** Stylesheet path relative to the project root (default per framework). */
  css?: string;
  namespace?: string;
  force?: boolean;
  dryRun?: boolean;
}

export type InitResult = CommandResult & { config?: TexuliConfig };

export interface ThemeApplyOptions {
  cwd: string;
  theme: string;
  force?: boolean;
  dryRun?: boolean;
}
