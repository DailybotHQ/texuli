<script lang="ts">
import { TREE_DENSITIES, TREE_VARIANTS, type TreeNode, TreeView } from 'texuli/tree';

const pages: readonly TreeNode[] = [
  {
    id: 'workspace',
    label: 'Orbit workspace',
    children: [
      {
        id: 'guides',
        label: 'Guides',
        children: [
          { id: 'getting-started', label: 'Getting started' },
          { id: 'accessibility', label: 'Accessibility' },
        ],
      },
      { id: 'release-notes', label: 'Release notes' },
      { id: 'archive', label: 'Archive', disabled: true },
    ],
  },
  { id: 'team', label: 'Team handbook' },
];

let expanded = $state(['workspace', 'guides']);
let selected = $state(['guides']);

const rtlPages: readonly TreeNode[] = [
  { id: 'arabic-guides', label: 'الأدلة', children: [{ id: 'arabic-start', label: 'البدء' }] },
  { id: 'arabic-about', label: 'حول الفريق' },
];
</script>

<section data-example="texuli-tree" aria-labelledby="tree-demo-title">
  <h2 id="tree-demo-title">TreeView</h2>

  <h3>Multiple selection</h3>
  <TreeView
    items={pages}
    bind:expanded
    bind:selected
    selectionMode="multiple"
    label="Workspace pages"
  />

  <h3>Every outer variant and density</h3>
  <div class="variants">
    {#each TREE_VARIANTS as variant (variant)}
      {#each TREE_DENSITIES as density (density)}
        <div class="variant-card">
          <h4>{variant} · {density}</h4>
          <TreeView
            items={pages}
            expanded={['workspace']}
            selected={['release-notes']}
            selectionMode="single"
            {variant}
            {density}
            label={`${variant} ${density} pages`}
          />
        </div>
      {/each}
    {/each}
  </div>

  <h3>Right to left</h3>
  <div class="rtl" dir="rtl" lang="ar">
    <TreeView items={rtlPages} expanded={['arabic-guides']} label="مجلدات الفريق" />
  </div>

  <h3>Dark mode</h3>
  <div class="dark-panel" data-tx-mode="dark">
    <TreeView items={pages} expanded={['workspace', 'guides']} selected={['getting-started']} selectionMode="multiple" label="Workspace pages in dark mode" />
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    max-inline-size: 56rem;
    color: CanvasText;
    background: Canvas;
  }

  h2,
  h3,
  h4 {
    margin: 0;
  }

  h3 {
    margin-block-start: 0.75rem;
    font-size: 0.95rem;
  }

  h4 {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .variants {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
    gap: 0.75rem;
  }

  .variant-card {
    display: grid;
    align-content: start;
    gap: 0.35rem;
    min-inline-size: 0;
  }

  .rtl,
  .dark-panel {
    padding: 0.75rem;
    border: 1px solid color-mix(in srgb, CanvasText 20%, Canvas);
    border-radius: 0.5rem;
  }

  .dark-panel {
    color-scheme: dark;
    color: CanvasText;
    background: Canvas;
  }
</style>
