<script lang="ts">
import type { CatalogPropSchema } from '@texuli/catalog';
import { jsonIssues, parseJsonDraft, prettyJson, type SchemaCheck } from './model.ts';

/**
 * An object or list prop with no sub-field editor yet, edited as JSON. The
 * text is checked as it is typed: a parse error, the renderer's kind rule
 * and, when the component publishes one, its schema check. Leaving the box
 * stores a value that parses (issues are shown, not hidden); text that does
 * not parse is never stored. A manifest example can seed the value.
 */
let {
  prop,
  value,
  check,
  examples = [],
  onchange,
}: {
  prop: CatalogPropSchema;
  value: unknown;
  check?: SchemaCheck;
  examples?: readonly { title: string; value: unknown }[];
  onchange: (next: unknown) => void;
} = $props();

const uid = $props.id();
let draft = $state<string | null>(null);
const text = $derived(draft ?? prettyJson(value));
const parsed = $derived(parseJsonDraft(text));
const issues = $derived(parsed.ok ? jsonIssues(prop, parsed.value, check) : []);
const label = $derived(`${prop.name}${prop.required ? ' · required' : ''}`);
const hint = $derived(
  [
    prop.description,
    check
      ? `Checked against ${check.source} as you type.`
      : 'No sub-field schema is published for this prop, so it is edited as JSON; the renderer checks only that it is an object or a list.',
    'Changes are saved when you leave the box.',
  ]
    .filter(Boolean)
    .join(' ')
);

function commit() {
  if (draft === null) return;
  if (!parsed.ok) return;
  onchange(parsed.value);
  draft = null;
}
</script>

<div class="json" data-tx-json={prop.name} data-checked={check ? 'schema' : 'kind'}>
  <label class="json__label" for={`${uid}-text`}>{label}</label>
  <textarea
    id={`${uid}-text`}
    class="json__text"
    rows="5"
    spellcheck="false"
    value={text}
    aria-invalid={!parsed.ok || issues.length > 0 ? 'true' : undefined}
    aria-describedby={`${uid}-hint ${uid}-issues`}
    oninput={(event) => (draft = event.currentTarget.value)}
    onblur={commit}
  ></textarea>
  <p id={`${uid}-hint`} class="json__hint">{hint}</p>
  <ul id={`${uid}-issues`} class="json__issues" data-json-issues>
    {#if !parsed.ok}<li data-severity="error">{parsed.message} Nothing was saved.</li>{/if}
    {#each issues as issue, index (index)}
      <li data-severity="error"><code>{issue.at}</code> {issue.message}</li>
    {/each}
  </ul>
  {#if examples.length}
    <div class="json__examples">
      {#each examples as example (example.title)}
        <button
          type="button"
          onclick={() => {
            draft = null;
            onchange(structuredClone(example.value));
          }}
        >Use example: {example.title}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .json {
    display: grid;
    gap: 0.35rem;
    margin-block: 0.75rem;
    font-size: 0.875rem;
  }
  .json__label {
    font-weight: 600;
  }
  .json__text {
    box-sizing: border-box;
    inline-size: 100%;
    padding: 0.55rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    font: 0.8125rem/1.4 ui-monospace, monospace;
    color: inherit;
    background: var(--tx-background, Canvas);
  }
  .json :is(textarea, button):focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .json [aria-invalid='true'] {
    border-color: var(--tx-destructive, Mark);
  }
  .json__hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .json__issues {
    margin: 0;
    padding-inline-start: 1.1rem;
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .json__issues:empty {
    display: none;
  }
  .json__examples {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .json__examples button {
    font: inherit;
    font-size: 0.8125rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    color: inherit;
    background: var(--tx-surface, Canvas);
    cursor: pointer;
  }
</style>
