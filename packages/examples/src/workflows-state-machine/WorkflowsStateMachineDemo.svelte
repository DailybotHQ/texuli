<script lang="ts">
import { WorkflowEditor, type WorkflowNodeContext } from '@texuli/workflows/editor';
import {
  applyWorkflowOps,
  createWorkflow,
  defineNodeTypes,
  type WorkflowGraph,
  type WorkflowOp,
} from '@texuli/workflows/model';

/** A fictional support ticket lifecycle: one state type, loops allowed. */
const registry = defineNodeTypes([
  {
    type: 'state',
    label: 'Estado',
    ports: [
      { id: 'in', direction: 'in', dataType: 'any', label: 'Entrada' },
      { id: 'out', direction: 'out', dataType: 'any', label: 'Salida' },
    ],
    props: {
      kind: {
        kind: 'enum',
        label: 'Tipo',
        values: ['inicial', 'intermedio', 'final'],
        default: 'intermedio',
      },
      sla: { kind: 'number', label: 'Horas', min: 0, max: 720 },
    },
  },
]);

const stateNode = (
  id: string,
  label: string,
  x: number,
  y: number,
  kind: string,
  sla?: number
): WorkflowOp => ({
  op: 'addNode',
  node: {
    id,
    type: 'state',
    label,
    position: { x, y },
    props: { kind, ...(sla === undefined ? {} : { sla }) },
  },
});
const move = (id: string, from: string, to: string, label: string): WorkflowOp => ({
  op: 'connect',
  edge: { id, from: { node: from, port: 'out' }, to: { node: to, port: 'in' }, label },
});

function initial(): WorkflowGraph {
  const result = applyWorkflowOps(
    createWorkflow({ cycles: 'allow' }),
    [
      stateNode('open', 'Abierto', 0, 96, 'inicial', 4),
      stateNode('working', 'En curso', 272, 96, 'intermedio', 24),
      stateNode('waiting', 'Esperando cliente', 272, 256, 'intermedio'),
      stateNode('solved', 'Resuelto', 544, 96, 'final'),
      move('t1', 'open', 'working', 'asignar'),
      move('t2', 'working', 'waiting', 'preguntar'),
      move('t3', 'waiting', 'working', 'respuesta'),
      move('t4', 'working', 'solved', 'resolver'),
    ],
    { registry }
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.graph;
}

let graph = $state.raw(initial());

const labels = {
  canvas: 'Diagrama de estados',
  toolbar: 'Herramientas',
  undo: 'Deshacer',
  redo: 'Rehacer',
  zoomIn: 'Acercar',
  zoomOut: 'Alejar',
  fit: 'Ajustar a la vista',
  autoLayout: 'Ordenar',
  remove: 'Eliminar selección',
  group: 'Agrupar selección',
  palette: 'Tipos de nodo',
  addNode: 'Añadir {type}',
  inputPort: '{port} de {node}',
  outputPort: '{port} de {node}',
  nodeSummary: '{type}. {count} conexiones.',
  nodeSelected: 'seleccionado',
  connected: 'Conectado {port} con {target}.',
  connectCancelled: 'Conexión cancelada.',
  removed: '{count} eliminados.',
  outline: 'Esquema del diagrama',
  outlineName: 'Nombre',
  outlineType: 'Tipo',
  outlineConnect: 'Conectar {node}',
  outlineDelete: 'Eliminar {node}',
  inspector: 'Propiedades',
  inspectorEmpty: 'Selecciona un estado para editarlo.',
  inspectorLabel: 'Nombre',
};
const messages = {
  roleDescription: 'estado',
  pickedUp: '{item} tomado.',
  dropped: '{item} movido.',
};
</script>

{#snippet stateBody(context: WorkflowNodeContext)}
  <span class="state" data-kind={context.node.props?.kind}>
    <strong>{context.node.label}</strong>
    {#if typeof context.node.props?.sla === 'number'}
      <small>SLA {context.node.props.sla} h</small>
    {/if}
  </span>
{/snippet}

<WorkflowEditor {graph} {registry} {labels} {messages} node={stateBody} onchange={(next) => (graph = next)} />

<style>
  .state {
    display: grid;
    gap: 0.125rem;
  }

  .state[data-kind='final'] strong {
    text-decoration: underline;
  }

  .state small {
    color: var(--tx-muted-foreground, GrayText);
  }
</style>
