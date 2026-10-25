/**
 * Demo screens for layout stages. Layouts receive their routed screen
 * through `mountScreen(target)`; these build it from text nodes only.
 */
import type { NavModel } from 'texuli/layouts/host';

export const DEMO_NAV: NavModel = {
  brand: { label: 'Harbor Notes', href: '#/' },
  sections: [
    {
      id: 'workspace',
      label: 'Workspace',
      items: [
        {
          id: 'inbox',
          label: 'Inbox',
          href: '#/inbox',
          icon: 'inbox',
          badge: 4,
          children: [
            { id: 'mentions', label: 'Mentions', href: '#/inbox/mentions' },
            { id: 'assigned', label: 'Assigned', href: '#/inbox/assigned' },
          ],
        },
        { id: 'notes', label: 'Notes', href: '#/notes', icon: 'file-text' },
        { id: 'archive', label: 'Archive', href: '#/archive', icon: 'archive' },
      ],
    },
    {
      id: 'team',
      label: 'Team',
      items: [{ id: 'people', label: 'People', href: '#/people', icon: 'users' }],
    },
  ],
  actions: [{ id: 'help', label: 'Help', icon: 'help', href: 'https://example.com/help' }],
  user: { name: 'Riley Morgan', detail: 'Workspace admin' },
};

type Section = { heading?: string; level?: 1 | 2 | 3; text: string };

/** A `mountScreen` callback that renders `sections` as headings and paragraphs. */
export function textScreen(sections: readonly Section[]): (target: HTMLElement) => void {
  return (target) => {
    const doc = target.ownerDocument;
    const nodes: HTMLElement[] = [];
    for (const section of sections) {
      if (section.heading) {
        const heading = doc.createElement(`h${section.level ?? 2}`);
        heading.textContent = section.heading;
        heading.id = section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        nodes.push(heading);
      }
      const p = doc.createElement('p');
      p.textContent = section.text;
      nodes.push(p);
    }
    target.replaceChildren(...nodes);
  };
}

export const APP_SCREEN = textScreen([
  { heading: 'Inbox', level: 1, text: 'Messages and tasks for the Harbor team.' },
  { text: 'Three threads need a reply today; two are waiting on design.' },
]);

export const ARTICLE_SCREEN = textScreen([
  {
    text: 'Useful interfaces give people a clear next step and enough context to understand why it matters.',
  },
  {
    heading: 'Start with a map',
    text: 'A good structure gives each topic a home. Keep labels familiar and the route back easy to find.',
  },
  {
    heading: 'Make progress visible',
    text: 'A short summary, a clear section title and a current contents link work together.',
  },
  {
    heading: 'Leave room to explore',
    text: 'Related links invite a deeper look while keeping the central story easy to follow.',
  },
]);
