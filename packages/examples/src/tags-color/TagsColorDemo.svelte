<script lang="ts">
import { ColorPicker, TagsInput } from 'texuli/tags-color';

let topics = $state(['design', 'research']);
let brand = $state('#3b82f6');
let accent = $state('#22c55e');
</script>

<section data-example="texuli-tags-color" aria-labelledby="tags-color-title">
  <h2 id="tags-color-title">TagsInput and ColorPicker</h2>

  <h3>Tags input</h3>
  <div class="stack" dir="rtl">
    <TagsInput
      bind:value={topics}
      label="Topics"
      inputLabel="Add a topic"
      placeholder="Type and press Enter"
      max={6}
    />
    <p class="hint">RTL field. Current: {topics.join(', ') || 'none'}</p>
  </div>

  <h3>Color picker</h3>
  <div class="row">
    <ColorPicker bind:value={brand} label="Brand color" />
    <ColorPicker
      bind:value={accent}
      label="Accent"
      format="hex"
      swatches={[
        { value: '#0ea5e9', label: 'Sky' },
        { value: '#22c55e', label: 'Green' },
        { value: '#e11d48', label: 'Rose' },
      ]}
    />
  </div>
  <p class="hint">Brand {brand} · Accent {accent}</p>
</section>

<style>
  h3 {
    margin-block: 1.25rem 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tx-muted-foreground, #575757);
  }
  .stack {
    display: grid;
    gap: 0.5rem;
    min-inline-size: 0;
    max-inline-size: min(100%, 24rem);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    min-inline-size: 0;
  }
  .hint {
    margin: 0.5rem 0 0;
    font-size: 0.875rem;
    color: var(--tx-muted-foreground, #575757);
  }
</style>
