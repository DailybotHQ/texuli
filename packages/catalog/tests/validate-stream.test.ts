// @vitest-environment node

import { safeParseBlock } from '@texuli/blocks/core';
import { createBlueprintAssembler } from '@texuli/spec/stream';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { createPlayer } from '../src/player/index.ts';
import { type CatalogTreeInput, renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import {
  checkStreamTotals,
  STREAM_WHOLE_TREE_CHECKS,
  streamNodeChain,
  validateDraft,
  validateStreamChain,
  validateStreamNode,
} from '../src/validate/index.ts';

/**
 * Node-level validation for streamed blueprints (ADR-014): a shell is
 * admitted only when `validateDraft`, run on its chain with the same
 * options, finds no error outside the whole-tree checks; whatever a node
 * check refuses in the full draft is refused at the node.
 */

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);
const options = { catalog, checkBlock: safeParseBlock };

const text = (markdown: string): CatalogTreeInput => ({
  id: 'blocks-text',
  props: { block: { type: 'text', markdown } },
});
const page = { id: 'layout-doc', props: { title: 'Fictional week' } };

/** Admit every node of `tree` in stream order, as a host would. */
function admitAll(tree: unknown) {
  const assembler = createBlueprintAssembler();
  const admitted = new Map<string, Record<string, unknown>>();
  const verdicts = new Map<string, boolean>();
  let count = 0;
  for (const event of [...assembler.write(JSON.stringify(tree)), ...assembler.end()]) {
    if (event.type !== 'node') continue;
    const ancestors: Record<string, unknown>[] = [];
    let ok = true;
    for (let at = event.parent; at !== null; ) {
      const shell = admitted.get(at);
      if (!shell) ok = false;
      else ancestors.unshift(shell);
      const cut = at.lastIndexOf('.children.');
      at = cut === -1 ? null : at.slice(0, cut);
    }
    const verdict =
      ok &&
      validateStreamNode(
        {
          header: null,
          ancestors,
          shell: event.shell,
          index: event.index,
          root: event.inArray && event.parent === null,
          admitted: count,
        },
        options
      ).ok;
    verdicts.set(event.path, verdict);
    if (verdict) {
      admitted.set(event.path, event.shell as Record<string, unknown>);
      count += 1;
    }
  }
  return verdicts;
}

describe('validateStreamNode', () => {
  it('admits a valid shell and builds its chain under the header', () => {
    const input = {
      header: { format: 'texuli-blueprint', version: 1 },
      ancestors: [page],
      shell: { ...text('Shipped on time.') } as Record<string, unknown>,
      index: 0,
      admitted: 1,
    };
    expect(streamNodeChain(input)).toEqual({
      format: 'texuli-blueprint',
      version: 1,
      tree: { ...page, children: [text('Shipped on time.')] },
    });
    const bare = validateStreamNode({ ...input, header: null }, options);
    expect(bare.diagnostics).toEqual([]);
    expect(bare.ok).toBe(true);
    // A childless layout fails only whole-tree checks: still admitted while streaming.
    const shell = validateStreamNode(
      { header: null, ancestors: [], shell: page, index: 0, admitted: 0 },
      options
    );
    expect(shell.ok).toBe(true);
    expect(STREAM_WHOLE_TREE_CHECKS).toEqual(['grammar', 'root']);
  });

  it('refuses every node-level rule: ids, props, URLs, sinks, fields, blocks', () => {
    const refused: Record<string, Record<string, unknown>> = {
      'unknown id': { id: 'not-a-component' },
      'unknown prop': { id: 'badge', props: { label: 'New', colour: 'red' } },
      'javascript URL': { id: 'link', props: { href: 'javascript:alert(1)', label: 'Open' } },
      'HTML string': { ...text('<img src=x onerror=alert(1)>') },
      'unknown node field': { id: 'badge', props: { label: 'New' }, style: 'color:red' },
      'bad block': { id: 'blocks-text', props: { block: { type: 'text' } } },
      'when without a runtime': { id: 'badge', props: { label: 'New' }, when: { gt: ['x', 1] } },
      'a malformed key (spec 0.7.0)': { key: 'intro / one', id: 'badge', props: { label: 'New' } },
    };
    for (const [name, shell] of Object.entries(refused)) {
      const result = validateStreamNode(
        { header: null, ancestors: [page], shell, index: 0, admitted: 1 },
        options
      );
      expect(result.ok, name).toBe(false);
      expect(result.diagnostics.length, name).toBeGreaterThan(0);
      // The same rule refuses the whole draft.
      expect(validateDraft({ ...page, children: [shell] }, options).ok, name).toBe(false);
    }
    // A header the envelope check refuses refuses every node under it.
    const header = { format: 'texuli-blueprint', version: 1, id: 'x', script: 'alert(1)' };
    expect(
      validateStreamNode({ header, ancestors: [], shell: page, index: 0, admitted: 0 }, options).ok
    ).toBe(false);
  });

  it('refuses nodes past the totals measured so far', () => {
    const limits = { maxNodes: 3, maxBranching: 2, maxRoots: 1 };
    expect(checkStreamTotals({ index: 0, admitted: 3, ancestors: [] }, limits)?.code).toBe(
      'nodes-exceeded'
    );
    expect(checkStreamTotals({ index: 2, admitted: 1, ancestors: [page] }, limits)?.code).toBe(
      'branching-exceeded'
    );
    expect(
      checkStreamTotals({ index: 1, root: true, admitted: 1, ancestors: [] }, limits)?.code
    ).toBe('roots-exceeded');
    expect(checkStreamTotals({ index: 1, admitted: 1, ancestors: [page] }, limits)).toBeNull();
    const many = { ...page, children: [text('a'), text('b'), text('c')] };
    const verdicts = admitAll(many);
    expect(verdicts.get('0.children.2')).toBe(true);
    expect(validateStreamChain({ ...page, children: [] }, { ...options, limits }).ok).toBe(true);
  });

  it('a node a check refuses in the full draft is refused at the node, and so is its subtree', () => {
    const tree = {
      ...page,
      children: [
        text('First.'),
        { id: 'layout-card', props: { title: 'Card', colour: 'red' }, children: [text('Inside.')] },
        text('Third.'),
        { id: 'link', props: { href: 'javascript:void(0)', label: 'Open' } },
      ],
    };
    const full = validateDraft(tree, options);
    expect(full.ok).toBe(false);
    const verdicts = admitAll(tree);
    expect(Object.fromEntries(verdicts)).toEqual({
      '0': true,
      '0.children.0': true,
      '0.children.1': false,
      '0.children.1.children.0': false,
      '0.children.2': true,
      '0.children.3': false,
    });
  });

  it('a player handle previews a partial draft, then judges it with the host policy', () => {
    const partial = { ...page, children: [text('First.'), { id: 'tx-stream-pending' }] };
    const handle = createPlayer({ blueprint: partial, catalog, invalidPolicy: 'preview' });
    // A pending marker is not a catalog id: previewed as a placeholder, never valid.
    expect(handle.state.surface).toBe('tree');
    expect(handle.state.validation.ok).toBe(false);
    handle.update({ invalidPolicy: 'refuse' });
    expect(handle.state.surface).toBe('notice');
    handle.update({ blueprint: { ...page, children: [text('Done.')] } });
    expect(handle.state.validation.ok).toBe(true);
    expect(handle.state.surface).toBe('tree');
    handle.dispose();
  });
});
