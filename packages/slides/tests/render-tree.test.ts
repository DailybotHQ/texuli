// @vitest-environment node
import { buildCatalog } from '@texuli/catalog/build';
import { discoverManifestGroups } from '@texuli/catalog/build/node';
import { checkCompositionGrammar, defaultGrammarRoles } from '@texuli/catalog/render/grammar';
import { renderCatalogFromBuild, renderCatalogTree } from '@texuli/catalog/render/renderer';
import { describe, expect, it } from 'vitest';
import {
  DECK_SLIDE_CATALOG_ID,
  parseDeckRenderTree,
  toDeckRenderTree,
} from '../src/grammar/index.ts';
import { parseDeck } from '../src/model/index.ts';

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);

function makeDeck() {
  const parsed = parseDeck({
    meta: {
      title: 'Quarterly review',
      description: 'Fictional quarter for Example Co.',
      locale: 'en-GB',
      aspect: '4:3',
      themeRef: { kind: 'catalog', id: 'graphite', mode: 'system' },
    },
    masters: ['title', 'content'],
    settings: { startIndex: 0, loop: true, defaultTransition: 'fade-up' },
    slides: [
      {
        id: 'opening',
        title: 'Opening',
        master: 'title',
        notes: 'Welcome everyone.\nKeep it short.',
        transition: 'none',
        blocks: [{ type: 'heading', level: 3, text: 'Three priorities' }],
      },
      {
        id: 'numbers',
        title: 'Numbers',
        themeRef: 'ocean',
        blocks: [
          { type: 'list', items: [{ text: 'Revenue up' }, { text: 'Churn down' }] },
          { type: 'code', lang: 'ts', code: 'const growth = 0.12;' },
        ],
      },
    ],
  });
  if (!parsed.success) throw new Error(parsed.issues[0]?.message);
  return parsed.deck;
}

describe('deck render tree (G11)', () => {
  it('renders every slide and block through the built catalog at the untrusted tier', () => {
    const tree = toDeckRenderTree(makeDeck());
    expect(tree.children?.map((node) => node.id)).toEqual([
      DECK_SLIDE_CATALOG_ID,
      DECK_SLIDE_CATALOG_ID,
    ]);
    const result = renderCatalogTree(tree, { catalog, tier: 'untrusted' });
    expect(result.diagnostics).toEqual([]);
    const root = result.roots[0];
    expect(root).toMatchObject({ kind: 'component', id: 'layout-deck' });
    if (root?.kind !== 'component') return;
    expect(root.props).toMatchObject({ aspect: '4:3', locale: 'en-GB' });
    expect(root.children[0]).toMatchObject({
      kind: 'component',
      id: 'deck-slide',
      props: { slideId: 'opening', notes: 'Welcome everyone.\nKeep it short.', transition: 'none' },
    });
  });

  it('passes the default composition grammar like a report does', () => {
    const { roots } = renderCatalogTree(toDeckRenderTree(makeDeck()), {
      catalog,
      tier: 'untrusted',
    });
    const grammar = checkCompositionGrammar(roots, { roles: defaultGrammarRoles });
    expect(grammar.issues).toEqual([]);
    expect(grammar.ok).toBe(true);

    // A block heading that skips below its slide title is caught per slide.
    const deep = toDeckRenderTree(makeDeck());
    const first = deep.children?.[0];
    if (first?.children?.[0]) {
      first.children[0] = {
        id: 'blocks-text',
        props: { block: { type: 'heading', level: 4, text: 'Too deep' } },
      };
    }
    const skipped = checkCompositionGrammar(
      renderCatalogTree(deep, { catalog, tier: 'untrusted' }).roots,
      { roles: defaultGrammarRoles }
    );
    expect(skipped.issues.map((issue) => `${issue.path} ${issue.code}`)).toEqual([
      '0.children.0.children.0 heading-skip',
    ]);
  });

  it('round-trips the deck through the tree, including JSON', () => {
    const deck = makeDeck();
    const tree = JSON.parse(JSON.stringify(toDeckRenderTree(deck)));
    expect(parseDeckRenderTree(tree)).toEqual({ success: true, deck, issues: [] });
  });

  it('rejects ambiguous, mistyped and invalid trees with tree paths', () => {
    const tree = toDeckRenderTree(makeDeck());
    expect(parseDeckRenderTree({ ...tree, props: { ...tree.props, slides: [] } }).issues).toEqual([
      {
        path: 'props.slides',
        message: 'The render tree form uses deck-slide children, not slides[].',
      },
    ]);
    expect(
      parseDeckRenderTree({ ...tree, children: [{ id: 'layout-card', props: {} }] }).issues[0]?.path
    ).toBe('children[0]');
    expect(parseDeckRenderTree({ ...tree, children: [] }).issues[0]?.path).toBe('children');

    const badId = JSON.parse(JSON.stringify(tree));
    badId.children[1].props.slideId = 'Not An Id';
    expect(parseDeckRenderTree(badId).issues[0]?.path).toBe('children[1].props.slideId');

    const badBlock = JSON.parse(JSON.stringify(tree));
    badBlock.children[0].children[0] = { id: 'blocks-text', props: { block: { type: 'list' } } };
    expect(parseDeckRenderTree(badBlock).success).toBe(false);

    const badTransition = JSON.parse(JSON.stringify(tree));
    badTransition.children[0].props.transition = 'zoom';
    const rendered = renderCatalogTree(badTransition, { catalog, tier: 'untrusted' });
    expect(rendered.diagnostics.map((d) => `${d.path} ${d.code}`)).toContain(
      '0.children.0 schema-failure'
    );
    expect(parseDeckRenderTree(badTransition).success).toBe(false);
  });

  it('refuses HTML-looking slide notes in the renderer, keeping the sink-free contract', () => {
    const tree = toDeckRenderTree(makeDeck());
    const first = tree.children?.[0];
    if (first) first.props = { ...first.props, notes: '<img src=x onerror=alert(1)>' };
    const result = renderCatalogTree(tree, { catalog, tier: 'untrusted' });
    expect(result.diagnostics.map((d) => d.code)).toContain('html-string');
  });
});
