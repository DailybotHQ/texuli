<script lang="ts">
import { FileDrop } from '../../src/file-drop/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<FileDrop.Root {...p('file-drop/FileDropRoot')} bind:ref={refs['file-drop/FileDropRoot']} />
