<script lang="ts">
import type { LayoutId } from 'texuli/layouts/host';
import { LayoutHost } from 'texuli/layouts/host';

type ContentLayoutId = Extract<LayoutId, 'docs' | 'blog' | 'editorial'>;

let { layout = 'docs' }: { layout?: ContentLayoutId } = $props();

const nav = {
  brand: { label: 'Northstar Journal', href: '#/' },
  sections: [
    {
      id: 'learn',
      label: 'Learn',
      items: [
        { id: 'overview', label: 'Overview', href: '#/overview' },
        { id: 'field-notes', label: 'Field notes', href: '#/field-notes' },
      ],
    },
  ],
};

const optionsByLayout = {
  docs: {
    title: 'A guide to calm workspaces',
    summary: 'A practical guide to creating a clear home for complex work.',
    eyebrow: 'Product guide',
  },
  blog: {
    title: 'Designing for the next small step',
    summary: 'How small, steady improvements make a tool easier to trust.',
    author: 'Mira Chen',
    date: 'October 14, 2026',
    readingTime: '6 minute read',
  },
  editorial: {
    title: 'The quiet craft of useful software',
    summary: 'A long read about the details that help teams find their way.',
    eyebrow: 'Field report · 08',
    author: 'Mira Chen',
    date: 'October 14, 2026',
    readingTime: '9 minute read',
  },
} as const;
</script>

<LayoutHost layout={layout} {nav} path="/overview" options={optionsByLayout[layout]}>
  {#snippet children()}
    <p>
      Useful interfaces give people a clear next step and enough context to understand why it matters.
      This guide gathers a few principles for building that kind of workspace.
    </p>
    <h2 id="start-with-a-map">Start with a map</h2>
    <p>
      A good structure gives each topic a home. Keep labels familiar and make the route back easy to
      find, especially when a reader arrives from a deep link.
    </p>
    <h3>Give every page a purpose</h3>
    <p>Put the main question near the beginning, then arrange supporting detail in a useful order.</p>
    <h2>Make progress visible</h2>
    <p>
      Small signals help readers understand where they are. A short summary, a clear section title
      and a current contents link can work together without competing for attention.
    </p>
    <h2>Leave room to explore</h2>
    <p>
      Related links and examples invite a deeper look while keeping the central story easy to follow.
      On a narrow screen, the same information should remain available without a tiny side column.
    </p>
  {/snippet}
</LayoutHost>
