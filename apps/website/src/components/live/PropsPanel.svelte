<script lang="ts">
/**
 * Interactive props panel from catalog schema: enum → segmented, boolean →
 * switch, number → number field, string → input.
 */

import { Switch } from 'texuli/choice';
import { Input } from 'texuli/input';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
import type { LivePropSchema } from './props-state.ts';
import { editableProps } from './props-state.ts';

type Props = {
  schema: readonly LivePropSchema[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
};

let { schema, values, onChange }: Props = $props();

/** Unique per panel: several panels can share a prop name on one page. */
const uid = $props.id();

const fields = $derived(editableProps(schema));

function str(name: string): string {
  const v = values[name];
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function num(name: string): number {
  const v = values[name];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function bool(name: string): boolean {
  return values[name] === true;
}
</script>

{#if fields.length > 0}
  <fieldset class="panel" data-tx-props-panel>
    <legend class="panel__legend">Props</legend>
    <div class="panel__grid">
      {#each fields as prop (prop.name)}
        <div class="field">
          <span class="label" id={`${uid}-${prop.name}-label`}>{prop.name}</span>
          {#if prop.kind === 'boolean'}
            <Switch
              checked={bool(prop.name)}
              onCheckedChange={(next) => onChange(prop.name, next)}
              label={prop.name}
            />
          {:else if prop.kind === 'enum' && prop.enumValues && prop.enumValues.length > 0}
            <ToggleGroup
              type="single"
              value={str(prop.name)}
              onValueChange={(next) => {
                if (typeof next === 'string' && next) onChange(prop.name, next);
              }}
              variant="outline"
              size="sm"
              wrap
              aria-labelledby={`${uid}-${prop.name}-label`}
            >
              {#each prop.enumValues as opt (opt)}
                <ToggleGroupItem value={opt}>{opt}</ToggleGroupItem>
              {/each}
            </ToggleGroup>
          {:else if prop.kind === 'number'}
            <Input
              id={`${uid}-${prop.name}-input`}
              type="number"
              value={String(num(prop.name))}
              onValueChange={(v) => {
                const n = Number(v);
                onChange(prop.name, Number.isFinite(n) ? n : 0);
              }}
              aria-labelledby={`${uid}-${prop.name}-label`}
            />
          {:else}
            <Input
              id={`${uid}-${prop.name}-input`}
              type="text"
              value={str(prop.name)}
              onValueChange={(v) => onChange(prop.name, v)}
              aria-labelledby={`${uid}-${prop.name}-label`}
            />
          {/if}
          {#if prop.description}
            <p class="hint">{prop.description}</p>
          {/if}
        </div>
      {/each}
    </div>
  </fieldset>
{/if}

<style>
  .panel {
    /* A fieldset defaults to min-content width: let it shrink with the page. */
    min-inline-size: 0;
    margin: 0;
    padding: 0.85rem 1rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, Canvas);
  }
  .panel__legend {
    padding-inline: 0.25rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--tx-foreground, CanvasText);
  }
  .panel__grid {
    display: grid;
    gap: 0.85rem;
  }
  .field {
    display: grid;
    gap: 0.35rem;
  }
  .label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--tx-foreground, CanvasText);
  }
  .hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--tx-foreground, CanvasText);
    opacity: 0.85;
  }
</style>
