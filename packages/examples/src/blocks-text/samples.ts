/**
 * Fictional block data for the text family examples (example.com only). The
 * demos pass these as untrusted input: `TextBlockView` validates each one.
 */

export const TEXT_FAMILY_SAMPLES: readonly unknown[] = [
  {
    type: 'heading',
    id: 'release-notes',
    level: 2,
    eyebrow: 'Release 4.2',
    text: 'Release notes for Harbor Notes',
    subtitle: 'What changed for teams this month',
  },
  {
    type: 'text',
    markdown:
      'Harbor Notes now **syncs drafts** across devices and keeps *offline edits* until you reconnect.\nRead the [migration guide](https://example.com/docs/migrate) or run `harbor sync`.\n\n## Highlights\n\n- [x] Faster search\n- [ ] Shared templates (next release)\n\n> Small releases, shipped often.',
  },
  {
    type: 'list',
    ordered: true,
    items: [
      { text: 'Open **Settings → Sync**.' },
      { text: 'Choose the devices to keep in step.' },
      { text: 'Confirm with the code sent to `team@example.com`.' },
    ],
  },
  {
    type: 'quote',
    quote: 'We stopped losing notes the week we switched. ~~No more~~ Zero lost drafts since.',
    cite: 'Avery Example, operations lead at Example Co.',
  },
  {
    type: 'callout',
    tone: 'info',
    title: 'Sync is on by default',
    body: 'Turn it off per workspace in **Settings**.',
  },
  {
    type: 'callout',
    tone: 'warning',
    title: 'Back up first',
    body: 'Export your workspace before you [change regions](https://example.com/regions).',
  },
];

/**
 * Hostile input the family must render inertly or reject: raw HTML, an
 * executable link, a bidi override (written as an escape) and a non-text type.
 */
export const TEXT_FAMILY_HOSTILE: readonly { label: string; block: unknown }[] = [
  {
    label: 'Raw HTML stays text',
    block: {
      type: 'text',
      markdown: 'Hello <img src=x onerror=alert(1)> and <script>alert(1)</script>.',
    },
  },
  {
    label: 'Executable link loses its href',
    block: {
      type: 'text',
      markdown: 'A [tempting link](javascript:alert(1)) renders as plain text.',
    },
  },
  {
    label: 'Bidi override is rejected',
    block: { type: 'callout', title: 'Invoice', body: 'Total \u202e00.001$' },
  },
  {
    label: 'Other families are rejected',
    block: { type: 'divider' },
  },
];
