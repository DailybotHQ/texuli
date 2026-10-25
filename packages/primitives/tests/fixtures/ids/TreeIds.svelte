<script lang="ts">
import { Tree } from '../../../src/tree/index.ts';

const items = [
  { id: 'harbor', label: 'Harbor' },
  { id: 'notes', label: 'notes.md' },
];
</script>

<Tree.Root id="files" {items} aria-label="Files" />
