/** Catalog trees for the custom elements tests (fictional content only). */

export const ARTICLE_TREE = [
  {
    id: 'blocks-text',
    props: {
      block: {
        type: 'heading',
        level: 2,
        text: 'Harbor quarterly notes',
        subtitle: 'What shipped',
      },
    },
  },
  {
    id: 'blocks-text',
    props: {
      block: { type: 'callout', tone: 'info', title: 'Heads up', body: 'Backups run nightly.' },
    },
  },
  { id: 'not-a-component', props: {} },
];

/** Every way an agent might try to smuggle markup or styling into the page. */
export const HOSTILE_TREE = [
  {
    id: 'blocks-text',
    props: {
      block: {
        type: 'callout',
        tone: 'info',
        title: '<img src=x onerror=alert(1)>',
        body: '<script>alert(2)</script>',
      },
      class: 'evil',
      style: 'position:fixed;inset:0',
      onclick: 'alert(3)',
    },
  },
  { id: 'blocks-text', props: { block: '<b>html string</b>' } },
  { id: 'script', props: { src: 'https://evil.example/x.js' } },
  { id: 'media-image', props: { src: 'javascript:alert(4)', alt: 'Bad' } },
];

/** Deeper than the default tree limits allow. */
export function deepTree(depth: number): unknown {
  let node: Record<string, unknown> = {
    id: 'blocks-text',
    props: { block: { type: 'text', text: 'leaf' } },
  };
  for (let i = 0; i < depth; i++)
    node = {
      id: 'blocks-text',
      props: { block: { type: 'text', text: `level ${i}` } },
      children: [node],
    };
  return node;
}
