<script lang="ts">
import * as Menubar from '../../../src/menubar/index.ts';
</script>

<Menubar.Root value="file" aria-label="Application">
  <Menubar.Menu value="file">
    <Menubar.Trigger id="file-trigger">File</Menubar.Trigger>
    <Menubar.Portal>
      <Menubar.Content id="file-menu">
        <Menubar.Item>New</Menubar.Item>
      </Menubar.Content>
    </Menubar.Portal>
  </Menubar.Menu>
</Menubar.Root>
