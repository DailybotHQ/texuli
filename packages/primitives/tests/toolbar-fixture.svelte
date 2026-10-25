<script lang="ts">
import { Toolbar } from '../src/toolbar/index.ts';

/** A text-formatting toolbar for the unit tests. */
let {
  orientation = 'horizontal',
  loop = true,
  dir,
  align = $bindable('left'),
  styles = $bindable<string[]>([]),
  onSave,
  onValueChange,
}: {
  orientation?: 'horizontal' | 'vertical';
  loop?: boolean;
  dir?: 'ltr' | 'rtl';
  align?: string;
  styles?: string[];
  onSave?: () => void;
  onValueChange?: (value: string | string[]) => void;
} = $props();
</script>

<button type="button">Before</button>
<div {dir} style:direction={dir}>
  <Toolbar.Root aria-label="Formatting" {orientation} {loop}>
    <Toolbar.Group type="multiple" aria-label="Text style" bind:value={styles}>
      <Toolbar.GroupItem value="bold">Bold</Toolbar.GroupItem>
      <Toolbar.GroupItem value="italic">Italic</Toolbar.GroupItem>
    </Toolbar.Group>
    <Toolbar.Separator data-testid="sep" />
    <Toolbar.Group type="single" aria-label="Alignment" bind:value={align} {onValueChange}>
      <Toolbar.GroupItem value="left">Left</Toolbar.GroupItem>
      <Toolbar.GroupItem value="center">Center</Toolbar.GroupItem>
      <Toolbar.GroupItem value="right" disabled>Right</Toolbar.GroupItem>
    </Toolbar.Group>
    <Toolbar.Separator />
    <Toolbar.Button onclick={onSave}>Save</Toolbar.Button>
    <Toolbar.Button disabled onclick={onSave}>Publish</Toolbar.Button>
    <Toolbar.Link href="https://example.com/help">Help</Toolbar.Link>
    <Toolbar.Link href="javascript:alert(1)">Unsafe</Toolbar.Link>
  </Toolbar.Root>
</div>
<button type="button">After</button>
