import { describe, expect, it } from 'vitest';
import { type ContractCase, checkContract } from '../../primitives/tests/support/contract.ts';
import { createContractRefs } from '../../primitives/tests/support/contract-refs.svelte.ts';
import DataContract from './contract/DataContract.svelte';

// The uniform component API contract (docs/STANDARDS.md) on the data roots a
// host composes (G93): rest attributes and `bind:ref` on the root element,
// caller handlers composed with the component's own behavior.

const CASES: ContractCase[] = [{ key: 'Board', harness: DataContract }];
const KEYS = CASES.map((c) => c.key);

describe('data component API contract (G93)', () => {
  for (const c of CASES) {
    it(`${c.key}: rest attributes, bind:ref and composed handlers`, async () => {
      const result = await checkContract(c, () => createContractRefs(KEYS));
      expect(result.failures).toEqual([]);
    });
  }
});
