/**
 * Every visible or announced string the code family renders that does not
 * come from the block itself. Hosts pass translations; English is the
 * default. `{name}` in a template is replaced by the block's name (its
 * filename, or its language in capitals).
 */
export interface CodeBlockLabels {
  /** Shown in place of a block that failed validation. */
  invalid: string;
  /** Name of a code block with neither a filename nor a language. */
  code: string;
  /** Visible copy button text, and its state texts. */
  copy: string;
  copied: string;
  copyFailed: string;
  /** Accessible name of the copy button (template with `{name}`). */
  copyName: string;
  /** Announced after a copy succeeds or fails. */
  copiedAnnouncement: string;
  copyFailedAnnouncement: string;
}

export const DEFAULT_CODE_BLOCK_LABELS: Readonly<CodeBlockLabels> = /* @__PURE__ */ Object.freeze({
  invalid: 'This block could not be shown.',
  code: 'Code',
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Copy failed',
  copyName: 'Copy {name} code',
  copiedAnnouncement: 'Code copied to the clipboard.',
  copyFailedAnnouncement: 'The code could not be copied.',
});

export type CodeBlockLabelOverrides = Partial<CodeBlockLabels>;

/** Merges host overrides over the English defaults; non-string overrides are ignored. */
export function resolveCodeBlockLabels(overrides: CodeBlockLabelOverrides = {}): CodeBlockLabels {
  const labels = { ...DEFAULT_CODE_BLOCK_LABELS };
  for (const key of Object.keys(labels) as (keyof CodeBlockLabels)[]) {
    const value = overrides[key];
    if (typeof value === 'string') labels[key] = value;
  }
  return labels;
}

/** Replaces every `{name}` in a label template (plain text, never markup). */
export function fillCodeLabel(template: string, name: string): string {
  return template.split('{name}').join(name);
}
