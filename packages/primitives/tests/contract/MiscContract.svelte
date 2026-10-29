<script lang="ts">
import { Progress } from '../../src/progress/index.ts';
import { RadioGroup } from '../../src/radio-group/index.ts';
import { SeparatorRoot } from '../../src/separator/index.ts';
import { Switch } from '../../src/switch/index.ts';
import { Toggle, ToggleGroup } from '../../src/toggle/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Progress.Root value={40} aria-label="Upload" {...p('progress/Progress')} bind:ref={refs['progress/Progress']} />
<RadioGroup.Root value="a" aria-label="Plan" {...p('radio-group/RadioGroup')} bind:ref={refs['radio-group/RadioGroup']}>
  <RadioGroup.Item value="a" aria-label="A" />
  <RadioGroup.Item value="b" aria-label="B" {...p('radio-group/RadioGroupItem')} bind:ref={refs['radio-group/RadioGroupItem']} />
</RadioGroup.Root>
<SeparatorRoot {...p('separator/SeparatorRoot')} bind:ref={refs['separator/SeparatorRoot']} />
<Switch.Root aria-label="Notify" {...p('switch/Root')} bind:ref={refs['switch/Root']}>
  <Switch.Thumb {...p('switch/Thumb')} bind:ref={refs['switch/Thumb']} />
</Switch.Root>
<Toggle.Root aria-label="Bold" {...p('toggle/Toggle')} bind:ref={refs['toggle/Toggle']}>B</Toggle.Root>
<ToggleGroup.Root type="single" aria-label="Align" {...p('toggle/ToggleGroup')} bind:ref={refs['toggle/ToggleGroup']}>
  <ToggleGroup.Item value="left">L</ToggleGroup.Item>
  <ToggleGroup.Item value="right" {...p('toggle/ToggleGroupItem')} bind:ref={refs['toggle/ToggleGroupItem']}>R</ToggleGroup.Item>
</ToggleGroup.Root>
