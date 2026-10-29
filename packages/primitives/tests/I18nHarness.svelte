<script lang="ts">
import type { I18n } from '@texuli/core/i18n';
import type { Component } from 'svelte';
import { setI18nContext } from '../src/i18n/index.ts';

let {
  i18n,
  component: Inner,
  props = {},
}: {
  i18n: I18n;
  component: Component<Record<string, unknown>>;
  props?: Record<string, unknown>;
} = $props();
// svelte-ignore state_referenced_locally
setI18nContext(i18n);
</script>

<Inner {...props} />
