<script lang="ts">
import * as Menubar from '../src/menubar/index.ts';

type Props = {
  value?: string;
  loop?: boolean;
  dir?: 'ltr' | 'rtl';
  log?: string[];
  onValueChange?: (value: string) => void;
};

let { value = $bindable(''), loop = true, dir, log = [], onValueChange }: Props = $props();
</script>

<button type="button">Before</button>
<!-- happy-dom computes direction from the style, not the dir attribute. -->
<div style:direction={dir}>
  <Menubar.Root bind:value {loop} {dir} {onValueChange} aria-label="Application" data-testid="bar">
    <Menubar.Menu value="file">
      <Menubar.Trigger>File</Menubar.Trigger>
      <Menubar.Content>
        <Menubar.Item onSelect={() => log.push('new')}>New</Menubar.Item>
        <Menubar.Item>Open</Menubar.Item>
        <Menubar.Sub>
          <Menubar.SubTrigger>Share</Menubar.SubTrigger>
          <Menubar.SubContent>
            <Menubar.Item>Email</Menubar.Item>
            <Menubar.Item>Link</Menubar.Item>
          </Menubar.SubContent>
        </Menubar.Sub>
      </Menubar.Content>
    </Menubar.Menu>
    <Menubar.Menu value="edit">
      <Menubar.Trigger>Edit</Menubar.Trigger>
      <Menubar.Content>
        <Menubar.Item>Undo</Menubar.Item>
        <Menubar.Item>Redo</Menubar.Item>
      </Menubar.Content>
    </Menubar.Menu>
    <Menubar.Menu value="help">
      <Menubar.Trigger disabled>Help</Menubar.Trigger>
      <Menubar.Content>
        <Menubar.Item>About</Menubar.Item>
      </Menubar.Content>
    </Menubar.Menu>
    <Menubar.Menu value="view">
      <Menubar.Trigger>View</Menubar.Trigger>
      <Menubar.Content>
        <Menubar.Item>Zoom in</Menubar.Item>
        <Menubar.Item>Zoom out</Menubar.Item>
      </Menubar.Content>
    </Menubar.Menu>
  </Menubar.Root>
</div>
<button type="button">After</button>
