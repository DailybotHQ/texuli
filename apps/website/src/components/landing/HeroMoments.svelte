<script lang="ts">
/**
 * Real interactive Texuli moments for the home hero. One island; heavy chart
 * loads lazily. Every control is keyboard-operable.
 */
import { onMount } from 'svelte';
import { Avatar, AvatarGroup } from 'texuli/avatar';
import { Card, CardContent, CardHeader, CardTitle } from 'texuli/card';
import { DatePicker } from 'texuli/date';
import { NumberField } from 'texuli/number-pin';
import { Slider } from 'texuli/slider';
import { Tabs } from 'texuli/tabs-accordion';
import { Toggle, ToggleGroup, ToggleGroupItem } from 'texuli/toggle';

type SparklineComponent = typeof import('@texuli/charts/compact').Sparkline;

let volume = $state(62);
let muted = $state(false);
let temp = $state<number | null>(21);
let mode = $state('auto');
let taskTab = $state('today');
let due = $state('2026-04-12');
let Sparkline = $state<SparklineComponent | null>(null);

const sparkValues = [4, 6, 5, 8, 7, 9, 11, 10, 12, 14, 13, 15] as const;

onMount(() => {
  void import('@texuli/charts/compact').then((mod) => {
    Sparkline = mod.Sparkline;
  });
});
</script>

<div class="moments" data-tx-landing-moments="">
  <h2 id="moments-title" class="moments__title">Live moments</h2>
  <div class="moments__grid" role="list" aria-labelledby="moments-title">
  <Card class="moment" variant="elevated" role="listitem" data-moment="media">
    <CardHeader>
      <CardTitle level={3}>Studio mix</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="moment__stack">
        <Slider
          bind:value={volume}
          min={0}
          max={100}
          step={1}
          label="Volume"
          showValue
          thumbLabel="Volume"
          disabled={muted}
        />
        <Toggle bind:pressed={muted} aria-label="Mute output">Mute</Toggle>
      </div>
    </CardContent>
  </Card>

  <Card class="moment" variant="elevated" role="listitem" data-moment="thermostat">
    <CardHeader>
      <CardTitle level={3}>Climate</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="moment__stack">
        <div class="field">
          <label for="landing-temp-input">Setpoint °C</label>
          <NumberField.Root id="landing-temp" bind:value={temp} min={16} max={28} step={0.5}>
            <NumberField.Decrement aria-label="Decrease temperature" />
            <NumberField.Input aria-label="Temperature setpoint" />
            <NumberField.Increment aria-label="Increase temperature" />
          </NumberField.Root>
        </div>
        <ToggleGroup type="single" bind:value={mode} variant="outline" aria-label="Climate mode">
          <ToggleGroupItem value="auto">Auto</ToggleGroupItem>
          <ToggleGroupItem value="cool">Cool</ToggleGroupItem>
          <ToggleGroupItem value="heat">Heat</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </CardContent>
  </Card>

  <Card class="moment" variant="elevated" role="listitem" data-moment="team">
    <CardHeader>
      <CardTitle level={3}>Harbor crew</CardTitle>
    </CardHeader>
    <CardContent>
      <AvatarGroup
        label="Harbor crew"
        max={4}
        size="md"
        items={[
          { name: 'Ada Example', status: 'online' },
          { name: 'Bea Harbor', status: 'away' },
          { name: 'Cal Orbit', status: 'busy' },
          { name: 'Dee Quill' },
          { name: 'Eli Sands', status: 'offline' },
        ]}
      />
      <p class="moment__meta">
        <Avatar name="Ada Example" size="sm" status="online" />
        Ada is reviewing the shipping checklist.
      </p>
    </CardContent>
  </Card>

  <Card class="moment" variant="elevated" role="listitem" data-moment="tasks">
    <CardHeader>
      <CardTitle level={3}>Tasks</CardTitle>
    </CardHeader>
    <CardContent>
      <Tabs
        bind:value={taskTab}
        label="Task lists"
        variant="pills"
        items={[
          { value: 'today', label: 'Today', badge: 2 },
          { value: 'week', label: 'This week' },
          { value: 'done', label: 'Done' },
        ]}
      >
        {#snippet content(item)}
          <p class="panel">
            {#if item.value === 'today'}
              Ship the landing hero and verify keyboard paths.
            {:else if item.value === 'week'}
              Theme strip polish and guide cross-links.
            {:else}
              Foundation and brand story pages.
            {/if}
          </p>
        {/snippet}
      </Tabs>
    </CardContent>
  </Card>

  <Card class="moment" variant="elevated" role="listitem" data-moment="chart">
    <CardHeader>
      <CardTitle level={3}>Pulse</CardTitle>
    </CardHeader>
    <CardContent>
      {#if Sparkline}
        <Sparkline values={[...sparkValues]} label="Weekly active builders" height={48} />
      {:else}
        <p class="moment__meta" data-chart-pending="">Loading chart…</p>
      {/if}
    </CardContent>
  </Card>

  <Card class="moment" variant="elevated" role="listitem" data-moment="date">
    <CardHeader>
      <CardTitle level={3}>Ship window</CardTitle>
    </CardHeader>
    <CardContent>
      <DatePicker label="Target date" bind:value={due} description="Fictional release window." />
    </CardContent>
  </Card>
  </div>
</div>

<style>
  .moments {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 0.75rem;
    padding: 0.75rem;
  }
  .moments__title {
    margin: 0;
    color: var(--tx-foreground);
    font-size: 1rem;
    font-weight: 700;
  }
  .moments__grid {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fill, minmax(14.5rem, 1fr));
  }
  .moments :global(.moment) {
    background: color-mix(in oklab, var(--tx-card, var(--tx-background)) 92%, transparent);
    backdrop-filter: blur(8px);
  }
  .moment__stack {
    display: grid;
    gap: 0.75rem;
  }
  .field {
    display: grid;
    gap: 0.35rem;
  }
  .field label {
    font-size: 0.85rem;
    color: var(--tx-muted-foreground);
  }
  .moment__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.75rem 0 0;
    color: var(--tx-muted-foreground);
    font-size: 0.85rem;
  }
  .panel {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
    color: var(--tx-foreground);
  }
</style>
