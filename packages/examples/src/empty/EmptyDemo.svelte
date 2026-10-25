<script lang="ts">
import { Button } from 'texuli/button';
import { EmptyState, ErrorState } from 'texuli/empty';

let fail = $state(false);

async function retry(): Promise<void> {
  await new Promise((r) => setTimeout(r, 200));
  fail = false;
}
</script>

<section data-example="texuli-empty" aria-labelledby="empty-demo-title">
  <h2 id="empty-demo-title">Empty and error states</h2>

  <h3>Empty (md)</h3>
  <EmptyState
    title="No notes yet"
    description="Create a note in Harbor Notes to fill this list. Fictional data only."
  >
    {#snippet action()}
      <Button size="sm">Add note</Button>
    {/snippet}
  </EmptyState>

  <h3>Empty (sm, RTL)</h3>
  <div dir="rtl">
    <EmptyState
      size="sm"
      title="Nothing here"
      description="Try another filter."
    />
  </div>

  <h3>Error with retry</h3>
  {#if fail}
    <ErrorState
      title="Could not load notes"
      message="The network is offline (simulated)."
      onRetry={retry}
    />
  {:else}
    <p>
      <Button variant="outline" size="sm" onclick={() => (fail = true)}>Simulate failure</Button>
    </p>
  {/if}
</section>
