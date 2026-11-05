<script lang="ts">
import type { LabelDictionary } from '@texuli/core/i18n';
import LabelsProvider from '../src/i18n/LabelsProvider.svelte';
import { Breadcrumb, Timeline } from '../src/index.ts';

let {
  outer,
  inner,
  locale = 'es',
}: { outer: LabelDictionary; inner: LabelDictionary; locale?: string } = $props();
</script>

<LabelsProvider labels={outer} {locale}>
  <Breadcrumb items={[{ label: 'Inicio', href: '/' }, { label: 'Informes' }]} />
  <LabelsProvider labels={inner} {locale}>
    <Timeline
      items={[
        { title: 'Arranque', status: 'complete' },
        { title: 'Revisión', status: 'current' },
      ]}
      messages={{ current: 'Ahora mismo' }}
    />
  </LabelsProvider>
</LabelsProvider>
