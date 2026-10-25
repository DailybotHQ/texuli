<script lang="ts">
/**
 * Lazy entry for LiveStage on component pages; only LiveDemo imports it, and
 * only dynamically. That keeps a dynamic boundary in front of the stage
 * families (so a page does not collect every family's CSS) without sharing a
 * module between static and lazy imports (which makes the bundler drag an
 * unrelated chunk in for its namespace helper).
 */
import LiveStage from './LiveStage.svelte';
import type { StageFamily, StageModule } from './stage-map.ts';

type Props = {
  componentId: string;
  values: Readonly<Record<string, unknown>>;
  family: StageFamily | undefined;
  load?: () => Promise<StageModule>;
};

let { componentId, values, family, load }: Props = $props();
</script>

<LiveStage {componentId} {family} {values} {load} />
