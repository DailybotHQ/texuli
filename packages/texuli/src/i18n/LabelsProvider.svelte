<script lang="ts">
/**
 * One label dictionary for every Texuli component below (ADR-026): wrap the
 * app root (or a subtree) and pass the translated ids. Renders no element.
 * Changing `labels` or `locale` updates every label in place; ids removed
 * from `labels` keep their last value until the provider remounts.
 */
import { type LabelDictionary, type Message, mergeLabels } from '@texuli/core/i18n';
import type { Snippet } from 'svelte';
import { setTexuliLabels } from './use-messages.ts';

let {
  labels = {},
  locale = 'en',
  children,
}: {
  /** Message ids to translations (`TexuliLabels`, or a union with domain ids). */
  labels?: LabelDictionary;
  /** The dictionary's BCP 47 locale: plural rules and number formatting. */
  locale?: string;
  children?: Snippet;
} = $props();

// svelte-ignore state_referenced_locally
const i18n = setTexuliLabels(labels, { locale });
// svelte-ignore state_referenced_locally
let applied: { labels: LabelDictionary; locale: string } = { labels, locale };

$effect.pre(() => {
  const next = { labels, locale };
  if (next.labels === applied.labels && next.locale === applied.locale) return;
  applied = next;
  i18n.addCatalog({
    locale: next.locale,
    messages: { ...mergeLabels(next.labels) } as Record<string, Message>,
  });
  void i18n.setLocale(next.locale);
});
</script>

{@render children?.()}
