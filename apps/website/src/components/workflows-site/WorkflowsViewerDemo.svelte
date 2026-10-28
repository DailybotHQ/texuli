<script lang="ts">
import { WorkflowViewer } from '@texuli/workflows/viewer';
import { NODE_SIZE, PIPELINE_REGISTRY, pipelineGraph } from './pipeline.ts';

/** The read-only viewer: the same graph, laid out top to bottom, no editing chrome. */
const graph = pipelineGraph('TB');
</script>

<WorkflowViewer
  {graph}
  registry={PIPELINE_REGISTRY}
  nodeSize={() => NODE_SIZE}
  flow="TB"
  label="Order automation (read only)"
/>
