<script lang="ts">
import { Badge } from 'texuli/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'texuli/card';

const imports = [
  { path: 'texuli/button', note: 'One control family' },
  { path: 'texuli/field', note: 'Label + error shell' },
  { path: 'texuli/input', note: 'Text controls' },
  { path: '@texuli/core/roving', note: 'Texel, not the root barrel' },
] as const;
</script>

<div class="guide-live" data-guide-live="performance">
  <p class="guide-live__label">Live · prefer subpath imports</p>
  <Card variant="flat">
    <CardHeader>
      <CardTitle level={3}>Lazy-friendly imports</CardTitle>
      <CardDescription>
        <Badge variant="secondary">budgets per subpath</Badge>
      </CardDescription>
    </CardHeader>
    <CardContent>
      <ul>
        {#each imports as item (item.path)}
          <li>
            <code>{item.path}</code>
            <span>{item.note}</span>
          </li>
        {/each}
      </ul>
    </CardContent>
  </Card>
</div>

<style>
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.5rem;
  }
  li {
    display: grid;
    gap: 0.15rem;
    min-inline-size: 0;
  }
  code {
    overflow-wrap: anywhere;
    font-size: 0.8125rem;
  }
  span {
    font-size: 0.8125rem;
    color: var(--tx-foreground);
  }
</style>
