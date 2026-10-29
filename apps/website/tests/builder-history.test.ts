/**
 * The builder's history labels name every edit op, including the
 * `patchDocument` op of spec 0.7.0 (a bounded patch to a `document` node,
 * by path or by key). Before it had a case, the label was `undefined` and
 * `astro check` failed on the switch.
 */
import { describe, expect, it } from 'vitest';
import { describeEdit } from '../src/components/builder/history/model.ts';

const tree = {
  id: 'layout-page',
  children: [{ key: 'brief', id: 'document', props: { doc: {} } }],
};
const labelOf = (id: string) => (id === 'document' ? 'Document' : id);

describe('builder history labels', () => {
  it('names a document patch by path, and by key', () => {
    const patch = [{ op: 'replace', path: '/meta/title', value: 'Brief' }] as const;
    expect(describeEdit(tree as never, [{ op: 'patchDocument', path: [0], patch }], labelOf)).toBe(
      'Edit Document'
    );
    expect(
      describeEdit(tree as never, [{ op: 'patchDocument', key: 'brief', patch }], labelOf)
    ).toBe('Edit the document');
  });
});
