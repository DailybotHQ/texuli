<script lang="ts">
// A representative set of texuli, @texuli/primitives, @texuli/blocks and
// @texuli/pages components under one label dictionary (ADR-026).

import { CodeBlockView } from '@texuli/blocks/code/renderers';
import DiagramFamily from '@texuli/blocks/diagram/renderers';
import { InteractiveBlockView } from '@texuli/blocks/interactive/renderers';
import { TextBlockView } from '@texuli/blocks/text/renderers';
import type { LabelDictionary } from '@texuli/core/i18n';
import type { TexuliDocument } from '@texuli/document/model';
import { Breadcrumb, createToastStore, Kpi, Pagination, Stat, Timeline, Toaster } from 'texuli';
import { LabelsProvider } from 'texuli/i18n';
import PageEditor from '../src/editor/PageEditor.svelte';
import PageReader from '../src/reader/PageReader.svelte';

let { labels, doc }: { labels: LabelDictionary; doc: TexuliDocument } = $props();
const store = createToastStore({ duration: 0 });
</script>

<LabelsProvider {labels} locale="es">
  <Breadcrumb items={[{ label: 'Inicio', href: '/' }, { label: 'Informes' }]} />
  <Pagination.Root page={2} pageCount={5} />
  <Toaster {store} />
  <Timeline
    items={[
      { title: 'Arranque', status: 'complete' },
      { title: 'Revisión', status: 'current' },
      { title: 'Lanzamiento', status: 'upcoming' },
    ]}
  />
  <Kpi label="Ingresos" value={null} />
  <Stat label="Pedidos" value="12" delta={3} />
  <TextBlockView block={{ type: 'callout', tone: 'info', body: 'Copia de seguridad hecha.' }} />
  <TextBlockView block={{ type: 'callout', tone: 'warning', body: 'Revisa antes de publicar.' }} />
  <InteractiveBlockView
    block={{
      type: 'checklist',
      items: [
        { id: 'a', label: 'Revisar combustible' },
        { id: 'b', label: 'Asegurar cabos', done: true },
      ],
    }}
  />
  <DiagramFamily
    block={{
      type: 'board',
      columns: [
        { id: 'todo', title: 'Pendiente', cards: [{ id: 'c1', title: 'Escribir resumen' }] },
        { id: 'done', title: 'Hecho', cards: [] },
      ],
    }}
  />
  <DiagramFamily
    block={{ type: 'terminal', lines: [{ kind: 'prompt', text: 'pnpm build' }] }}
  />
  <CodeBlockView block={{ type: 'code', lang: 'ts', code: 'const a = 1;' }} />
  <PageReader document={doc} />
  <PageEditor document={doc} />
</LabelsProvider>
