<script lang="ts">
import { CanvasViewer } from '@texuli/canvas/viewer';
import { launchPlanFixture } from './fixtures/launch-plan.ts';

const canvas = launchPlanFixture();
</script>

<CanvasViewer {canvas} label="Launch plan canvas preview" />
