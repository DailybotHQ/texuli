<script lang="ts">
import { Badge } from 'texuli/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'texuli/card';

let mode = $state<'light' | 'dark' | 'unknown'>('unknown');

$effect(() => {
  const root = document.documentElement;
  const read = () => {
    const value = root.getAttribute('data-tx-mode');
    mode = value === 'dark' || value === 'light' ? value : 'unknown';
  };
  read();
  const observer = new MutationObserver(read);
  observer.observe(root, { attributes: true, attributeFilter: ['data-tx-mode'] });
  return () => observer.disconnect();
});
</script>

<div class="guide-live" data-guide-live="dark-mode">
  <p class="guide-live__label">Live · current appearance</p>
  <Card variant="flat">
    <CardHeader>
      <CardTitle level={3}>data-tx-mode</CardTitle>
      <CardDescription>
        {#if mode === 'unknown'}
          <Badge variant="secondary">reading…</Badge>
        {:else}
          <Badge data-guide-mode={mode}>{mode}</Badge>
        {/if}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p>
        Use the light / dark / system control in the site header. The no-flash script sets
        <code>data-tx-mode</code> before paint so the first frame matches the stored preference.
      </p>
    </CardContent>
  </Card>
</div>

<style>
  p {
    margin: 0;
  }
</style>
