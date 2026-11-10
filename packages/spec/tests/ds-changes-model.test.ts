import { describe, expect, it } from 'vitest';
import { changesModel } from '../src/design-system/index.ts';

const allowDocument = (count: number) => ({
  id: 'model-test',
  version: '1.0.0',
  allow: Object.fromEntries(
    Array.from({ length: count }, (_, index) => [`component-${index}`, {}])
  ),
});

describe('design-system changes model', () => {
  it('reads the full document allow cap and warns when changes exceed it', () => {
    const atCap = changesModel(
      { document: { ...allowDocument(0), allow: {} } },
      { document: allowDocument(4096) }
    );
    expect(atCap.allow).toHaveLength(4096);
    expect(atCap.warnings).toEqual([]);

    const overCap = changesModel(
      { document: { ...allowDocument(0), allow: {} } },
      { document: allowDocument(4097) }
    );
    expect(overCap.allow).toHaveLength(4096);
    expect(overCap.warnings).toEqual([
      'Allow change details omit 1 component beyond the 4096-component limit.',
    ]);
  });

  it('reports library re-approval changes including approver, version and content hash', () => {
    const before = {
      id: 'model-test',
      library: [
        {
          id: 'shared-card',
          name: 'Shared card',
          purpose: 'Card for examples',
          version: '1.0.0',
          status: 'approved',
          approval: {
            status: 'draft',
            approvedBy: 'Alex',
            version: '1.0.0',
            contentHash: 'hash-before',
          },
        },
      ],
    };
    const after = {
      ...before,
      library: [
        {
          ...before.library[0],
          approval: {
            status: 'approved',
            approvedBy: 'Sam',
            version: '1.1.0',
            contentHash: 'hash-after',
          },
        },
      ],
    };

    expect(changesModel({ document: before }, { document: after }).library).toEqual([
      {
        kind: 'changed',
        id: 'shared-card',
        fields: [
          { field: 'approval.status', before: 'draft', after: 'approved' },
          { field: 'approval.approvedBy', before: 'Alex', after: 'Sam' },
          { field: 'approval.version', before: '1.0.0', after: '1.1.0' },
          { field: 'approval.contentHash', before: 'hash-before', after: 'hash-after' },
        ],
      },
    ]);
  });
});
