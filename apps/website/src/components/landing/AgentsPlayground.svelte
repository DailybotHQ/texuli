<script lang="ts">
/**
 * Tiny live result for the agents section: real Badge + Button on a Card.
 */
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from 'texuli/card';

let open = $state(false);
</script>

<div class="play" data-tx-landing-agents-play="" aria-label="Safe renderer result">
  <p class="play__label">Safe renderer result</p>
  <Card variant="elevated">
    <CardHeader>
      <CardTitle level={3}>Harbor pulse</CardTitle>
      <Badge variant="secondary">Live</Badge>
    </CardHeader>
    <CardContent>
      <p>
        {open
          ? 'Checklist open: keyboard paths and theme tokens stay on the owned components.'
          : 'A catalog tree becomes this card—no raw HTML from the agent.'}
      </p>
    </CardContent>
    <CardFooter>
      <Button
        variant="outline"
        size="sm"
        aria-pressed={open ? 'true' : 'false'}
        onclick={() => {
          open = !open;
        }}
      >
        {open ? 'Close' : 'Open'}
      </Button>
    </CardFooter>
  </Card>
</div>

<style>
  .play {
    display: grid;
    gap: 0.5rem;
  }
  .play__label {
    margin: 0;
    color: var(--tx-muted-foreground);
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
  .play p {
    margin: 0;
    color: var(--tx-foreground);
  }
</style>
