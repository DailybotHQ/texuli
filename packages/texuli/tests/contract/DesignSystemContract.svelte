<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { DesignSystemProvider } from '../../src/design-system/index.ts';

let { p, refs }: HarnessProps = $props();
const key = 'design-system/DesignSystemProvider';
const compiled = {
  id: 'demo',
  vars: { light: { '--tx-background': '#ffffff' } },
  attrs: { 'data-tx-ds': 'demo' },
  fontFaces: [],
  defaults: {},
};
</script>

<DesignSystemProvider {compiled} {...p(key)} bind:ref={refs[key]}>Scoped</DesignSystemProvider>
