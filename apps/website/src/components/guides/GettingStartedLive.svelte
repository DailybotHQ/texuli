<script lang="ts">
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'texuli/card';

let clicks = $state(0);
</script>

<div class="guide-live" data-guide-live="getting-started">
  <p class="guide-live__label">Live · Button and Card</p>
  <Card variant="flat">
    <CardHeader>
      <CardTitle level={3}>Harbor workspace</CardTitle>
      <CardDescription>
        <Badge variant="secondary">example.com</Badge>
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p>This card is the same <code>texuli/card</code> your app imports.</p>
      <div class="actions">
        <Button
          size="sm"
          onclick={() => {
            clicks += 1;
          }}
        >
          {clicks === 0 ? 'Try the button' : `Clicked ${clicks}`}
        </Button>
        <Button size="sm" variant="outline">Outline</Button>
      </div>
    </CardContent>
  </Card>
</div>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-block-start: 0.75rem;
  }
  p {
    margin: 0;
  }
</style>
