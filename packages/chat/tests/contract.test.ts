import { describe, expect, it } from 'vitest';
import { type ContractCase, checkContract } from '../../primitives/tests/support/contract.ts';
import { createContractRefs } from '../../primitives/tests/support/contract-refs.svelte.ts';
import ChatContract from './contract/ChatContract.svelte';

// The uniform component API contract (docs/STANDARDS.md) on the chat roots a
// host composes (G93): rest attributes and `bind:ref` on the root element,
// caller handlers composed with the component's own behavior.

const CASES: ContractCase[] = [
  { key: 'ChatThread', harness: ChatContract },
  { key: 'MessageList', harness: ChatContract },
  {
    key: 'Composer',
    harness: ChatContract,
    skip: {
      keydown:
        'the documented `onkeydown` prop reaches the textarea (Enter to send), not the form root',
    },
  },
  { key: 'TypingIndicator', harness: ChatContract },
];
const KEYS = CASES.map((c) => c.key);

describe('chat component API contract (G93)', () => {
  for (const c of CASES) {
    it(`${c.key}: rest attributes, bind:ref and composed handlers`, async () => {
      const result = await checkContract(c, () => createContractRefs(KEYS));
      expect(result.failures).toEqual([]);
    });
  }
});
