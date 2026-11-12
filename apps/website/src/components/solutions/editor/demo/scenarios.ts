/**
 * Fixture documents and clipboard samples for the Rich text editor demo. Fictional teams and
 * people; every link points at example.com. Nothing is saved or sent anywhere. Documents start
 * at heading level 2, so the page keeps its one h1.
 */

export interface EditorScenario {
  readonly id: 'release-notes' | 'support-macro' | 'meeting-note';
  readonly label: string;
  /** Read at the untrusted tier, as an agent's or a user's Markdown would be. */
  readonly markdown: string;
}

export const SCENARIOS: readonly EditorScenario[] = [
  {
    id: 'release-notes',
    label: 'Release notes',
    markdown: `## Northwind 2.4 release notes

**Released** 12 November 2026 for the *Northwind* pilot team.

### New

- [x] Saved views in the [dashboard](https://example.com/docs/views)
- [x] CSV export for every table
- [ ] Dark mode for the mobile app

### Fixed

1. Search keeps your filters
2. Dates show in your time zone

> Thanks to everyone who reported the filter bug 🎉

Questions? Reply in #northwind-pilot.`,
  },
  {
    id: 'support-macro',
    label: 'Support macro',
    markdown: `## Password reset

Hi there, thanks for reaching out to **Acme Support**.

To reset your password:

1. Open [example.com/reset](https://example.com/reset)
2. Enter the email on your account
3. Follow the link we send within *10 minutes*

If the email does not arrive, check your spam folder or reply to this message.

— The Acme team`,
  },
  {
    id: 'meeting-note',
    label: 'Meeting note',
    markdown: `## Design sync, 12 November

**Attendees:** Ada, Grace, Linus

### Decisions

- Ship the ~~blue~~ green theme
- Keep \`theme-v2\` behind a flag

### Action items

- [ ] Ada drafts the onboarding copy
- [x] Grace books the review room

Next sync: Thursday at 10:00.`,
  },
];

/**
 * Clipboard HTML from a fictional wiki page: a heading, marks, a safe link, a `javascript:` link
 * the URL policy refuses, an inline handler and a script that are dropped, and a list.
 */
const SCRIPT = 'scr' + 'ipt';
export const PASTE_HTML = [
  '<p>From the team wiki:</p>',
  '<h2>Q4 planning</h2>',
  '<p onclick="steal()">Read the <a href="https://example.com/plan">plan</a> ',
  `and <a href="javascript:alert('hi')">this link</a> before <b>Friday</b>.</p>`,
  `<${SCRIPT}>steal()</${SCRIPT}>`,
  '<ul><li>Budget review</li><li>Hiring</li></ul>',
].join('');

/** Plain text that only becomes structure with "Paste as Markdown". */
export const PASTE_MARKDOWN = `From a chat message:

### Launch checklist

- [x] **Docs** are live
- [ ] Announce in [the blog](https://example.com/blog)`;
