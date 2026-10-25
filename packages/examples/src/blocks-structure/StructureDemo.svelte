<script lang="ts">
import { StructureFamily } from '@texuli/blocks/structure/renderers';

const columns = {
  type: 'columns',
  columns: [
    [
      { type: 'heading', level: 3, text: 'Plan' },
      { type: 'text', markdown: 'Write the brief for Harbor Labs.' },
    ],
    [
      { type: 'heading', level: 3, text: 'Ship' },
      { type: 'text', markdown: 'Validate, export and review.' },
    ],
  ],
};

const grid = {
  type: 'grid',
  title: 'Harbor squads',
  columns: 3,
  cells: [
    { title: 'Design', body: 'Tokens, themes and contrast.', tone: 'info' },
    { title: 'Build', body: 'Components and content blocks.', tone: 'success' },
    { title: 'Review', body: 'A11y and keyboard checks.', tone: 'warning' },
  ],
};

const tabs = {
  type: 'tabs',
  id: 'harbor-areas',
  label: 'Harbor product areas',
  defaultPanel: 'design',
  panels: [
    {
      id: 'design',
      label: 'Design',
      blocks: [
        { type: 'heading', level: 3, text: 'Design' },
        { type: 'text', markdown: 'Palettes, type scales and density.' },
      ],
    },
    {
      id: 'build',
      label: 'Build',
      blocks: [{ type: 'text', markdown: 'Primitives, components and structure blocks.' }],
    },
  ],
};

const accordion = {
  type: 'accordion',
  id: 'harbor-faq',
  label: 'Harbor FAQ',
  mode: 'single',
  items: [
    {
      id: 'what',
      title: 'What is Harbor?',
      body: 'A **fictional** product lab used only in examples.',
    },
    {
      id: 'limits',
      title: 'What are the limits?',
      body: 'Short markdown, shallow nesting and the untrusted URL policy.',
    },
  ],
};

const cards = {
  type: 'cards',
  title: 'Harbor resources',
  columns: 2,
  items: [
    {
      title: 'Design system',
      eyebrow: 'Tokens',
      body: 'Palettes, type and density.',
      href: 'https://example.com/design',
      tone: 'info',
    },
    {
      title: 'Component kit',
      eyebrow: 'UI',
      body: 'Buttons, cards and tabs.',
      href: 'https://example.com/ui',
      tone: 'success',
    },
  ],
};

const cta = {
  type: 'cta',
  actions: [
    { label: 'Read the guide', href: 'https://example.com/guide' },
    { label: 'Contact Harbor', href: 'mailto:hello@example.com' },
  ],
};

const hostile = {
  type: 'cards',
  items: [{ title: `Click${String.fromCharCode(0x202e)}me`, href: 'javascript:alert(1)' }],
};
</script>

<section data-example="blocks-structure" aria-labelledby="structure-demo-title">
  <h2 id="structure-demo-title">Structure blocks</h2>

  <h3>Columns</h3>
  <StructureFamily block={columns} />

  <h3>Grid</h3>
  <StructureFamily block={grid} />

  <h3>Tabs</h3>
  <StructureFamily block={tabs} />

  <h3>Accordion</h3>
  <StructureFamily block={accordion} />

  <h3>Cards</h3>
  <StructureFamily block={cards} />

  <h3>Divider and CTA</h3>
  <StructureFamily block={{ type: 'divider' }} />
  <StructureFamily block={cta} />

  <h3>Hostile input</h3>
  <StructureFamily block={hostile} />
</section>
