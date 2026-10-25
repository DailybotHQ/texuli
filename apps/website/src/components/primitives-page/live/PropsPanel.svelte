<script lang="ts">
/**
 * The props panel, built from a demo's prop specs (the manifest prop kinds):
 * enum as a segmented control, boolean as a switch, number as a slider and
 * string as a text field. Every control is a Texuli component.
 */
import { Switch } from 'texuli/choice';
import { Input } from 'texuli/input';
import { Slider } from 'texuli/slider';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
import type { PropSpec, PropValue } from './types.ts';

type Props = {
  specs: readonly PropSpec[];
  values: Record<string, PropValue>;
  idPrefix: string;
  onChange: (name: string, value: PropValue) => void;
};

let { specs, values, idPrefix, onChange }: Props = $props();

function enumValue(spec: PropSpec): string {
  const value = values[spec.name];
  return typeof value === 'string' ? value : String(spec.default);
}
</script>

<div class="panel" role="group" aria-labelledby="{idPrefix}-props-title" data-props-panel>
  <h3 class="panel__title" id="{idPrefix}-props-title">Props</h3>
  {#if specs.length === 0}
    <p class="panel__empty">This primitive has no visual props to tune.</p>
  {/if}
  {#each specs as spec (spec.name)}
    <div class="panel__row" data-prop={spec.name} data-kind={spec.kind}>
      {#if spec.kind === 'enum'}
        <span class="panel__label" id="{idPrefix}-{spec.name}">{spec.label}</span>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          aria-labelledby="{idPrefix}-{spec.name}"
          bind:value={
            () => enumValue(spec),
            (next) => {
              // A segmented control always has one choice: ignore a deselect.
              if (typeof next === 'string' && next) onChange(spec.name, next);
            }
          }
        >
          {#each spec.options as option (option)}
            <ToggleGroupItem value={option}>{option}</ToggleGroupItem>
          {/each}
        </ToggleGroup>
      {:else if spec.kind === 'boolean'}
        <Switch
          size="sm"
          label={spec.label}
          checked={values[spec.name] === true}
          onCheckedChange={(checked) => onChange(spec.name, checked)}
        />
      {:else if spec.kind === 'number'}
        <Slider
          size="sm"
          label={spec.label}
          showValue
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={typeof values[spec.name] === 'number' ? (values[spec.name] as number) : spec.default}
          onValueChange={(next) => onChange(spec.name, Array.isArray(next) ? (next[0] ?? spec.default) : next)}
        />
      {:else}
        <label class="panel__field">
          <span class="panel__label">{spec.label}</span>
          <Input
            value={typeof values[spec.name] === 'string' ? (values[spec.name] as string) : spec.default}
            onValueChange={(next) => onChange(spec.name, next)}
          />
        </label>
      {/if}
    </div>
  {/each}
</div>

<style>
  .panel {
    display: grid;
    gap: 0.75rem;
    align-content: start;
    min-inline-size: 0;
  }
  .panel__title {
    margin: 0;
    font-size: 0.9375rem;
  }
  .panel__empty {
    margin: 0;
    color: var(--tx-muted-foreground);
    font-size: 0.875rem;
  }
  .panel__row {
    display: grid;
    justify-items: start;
    gap: 0.375rem;
    min-inline-size: 0;
  }
  .panel__row[data-kind='boolean'],
  .panel__row[data-kind='number'] {
    justify-items: stretch;
  }
  .panel__field {
    display: grid;
    justify-self: stretch;
    gap: 0.375rem;
  }
  .panel__label {
    font-size: 0.875rem;
    font-weight: 500;
  }
</style>
