import { describe, expect, it } from 'vitest';
import { changesModel } from '../src/design-system/index.ts';

const entry = (index: number) => ({
  id: `kit-card-${index}`,
  name: `Kit card ${index}`,
  purpose: 'A reusable card component.',
  version: '1.0.0',
  status: 'draft',
  composes: ['card'],
  approval: {
    status: 'draft',
    approvedBy: 'A'.repeat(120),
    approvedAt: '2026-11-09T14:30:00Z',
    version: '1.0.0',
    contentHash: 'a'.repeat(64),
  },
});

describe('design-system library change model', () => {
  it('compares every approval field and preserves full values beyond 200 characters', () => {
    const before = { ...entry(0), purpose: 'A'.repeat(250) };
    const after = {
      ...before,
      purpose: 'B'.repeat(250),
      approval: {
        status: 'approved',
        approvedBy: 'B'.repeat(120),
        approvedAt: '2026-11-10T14:30:00Z',
        version: '1.1.0',
        contentHash: 'b'.repeat(64),
      },
    };

    expect(
      changesModel({ document: { library: [before] } }, { document: { library: [after] } }).library
    ).toEqual([
      {
        kind: 'changed',
        id: 'kit-card-0',
        fields: [
          { field: 'purpose', before: 'A'.repeat(250), after: 'B'.repeat(250) },
          {
            field: 'approval.status',
            before: 'draft',
            after: 'approved',
          },
          {
            field: 'approval.approvedBy',
            before: 'A'.repeat(120),
            after: 'B'.repeat(120),
          },
          {
            field: 'approval.approvedAt',
            before: '2026-11-09T14:30:00Z',
            after: '2026-11-10T14:30:00Z',
          },
          { field: 'approval.version', before: '1.0.0', after: '1.1.0' },
          { field: 'approval.contentHash', before: 'a'.repeat(64), after: 'b'.repeat(64) },
        ],
      },
    ]);
  });

  it('compares library entries after the schema cap of 64', () => {
    const before = Array.from({ length: 65 }, (_, index) => entry(index));
    const after = before.map((item, index) =>
      index === 64 ? { ...item, version: '1.1.0' } : item
    );

    expect(
      changesModel({ document: { library: before } }, { document: { library: after } }).library
    ).toEqual([
      {
        kind: 'changed',
        id: 'kit-card-64',
        fields: [{ field: 'version', before: '1.0.0', after: '1.1.0' }],
      },
    ]);
  });
});
