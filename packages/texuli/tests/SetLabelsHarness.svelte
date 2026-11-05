<script lang="ts">
import type { LabelDictionary } from '@texuli/core/i18n';
import type { Component } from 'svelte';
import { setTexuliLabels } from '../src/i18n/index.ts';

let {
  labels,
  component: Inner,
  props = {},
}: {
  labels: LabelDictionary;
  component: Component<Record<string, unknown>>;
  props?: Record<string, unknown>;
} = $props();
// svelte-ignore state_referenced_locally
setTexuliLabels(labels, { locale: 'es' });
</script>

<Inner {...props} />
