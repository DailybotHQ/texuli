<script lang="ts">
/**
 * Live component kit that inherits --tx-* from the studio preview host.
 */
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'texuli/card';
import { Input } from 'texuli/input';
</script>

<div class="kit" data-tx-studio-kit="">
  <div class="kit__row">
    <Button type="button" variant="default">Primary</Button>
    <Button type="button" variant="secondary">Secondary</Button>
    <Button type="button" variant="outline">Outline</Button>
    <Button type="button" variant="ghost">Ghost</Button>
    <Button type="button" variant="link">Link button</Button>
  </div>
  <div class="kit__row">
    <Badge variant="default">Default</Badge>
    <Badge variant="secondary">Secondary</Badge>
    <Badge variant="outline">Outline</Badge>
    <Badge variant="destructive">Destructive</Badge>
  </div>
  <Card variant="elevated">
    <CardHeader>
      <CardTitle level={3}>Harbor Notes preview</CardTitle>
      <CardDescription>Fictional ferry briefing card on the studio theme.</CardDescription>
    </CardHeader>
    <CardContent>
      <p class="kit__body">
        Live components re-read CSS variables when you generate or retune a role. No network.
      </p>
      <p class="kit__link-wrap">
        <a class="kit__link" href="#studio-export">Sample link</a>
      </p>
      <label class="kit__field">
        <span class="kit__label">Sample field</span>
        <Input type="text" value="captain@harbor.example" aria-label="Sample field" readonly />
      </label>
    </CardContent>
  </Card>
</div>

<style>
  .kit {
    display: grid;
    gap: 1rem;
    color: var(--tx-foreground);
    background: var(--tx-background);
  }
  .kit__row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .kit__body {
    margin: 0 0 0.75rem;
    color: var(--tx-muted-foreground, var(--tx-foreground));
    font-size: 0.9375rem;
  }
  .kit__link-wrap {
    margin: 0 0 0.75rem;
  }
  .kit__link {
    color: var(--tx-link, LinkText);
  }
  .kit__field {
    display: grid;
    gap: 0.35rem;
  }
  .kit__label {
    font-size: 0.8125rem;
    font-weight: 600;
  }
</style>
