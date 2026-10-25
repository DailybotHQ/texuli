<script lang="ts">
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Card, CardContent, CardDescription, CardGrid, CardHeader, CardTitle } from 'texuli/card';
</script>

<section class="landing" aria-label="Landing">
  <div class="hero">
    <Badge>Product</Badge>
    <h2>Harbor Notes for every crew</h2>
    <p>
      Small pieces. Infinite possibilities. A fictional landing built only with Texuli cards, badges
      and buttons — static HTML after build.
    </p>
    <div class="hero__actions">
      <Button type="button">Start free trial</Button>
      <Button type="button" variant="secondary">View docs</Button>
    </div>
  </div>
  <CardGrid minItemWidth="14rem">
    <Card variant="elevated">
      <CardHeader>
        <CardTitle level={3}>Accessible by default</CardTitle>
        <CardDescription>Keyboard, focus, and AA contrast</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Primitives carry the behavior; styled layers carry the theme.</p>
      </CardContent>
    </Card>
    <Card variant="elevated">
      <CardHeader>
        <CardTitle level={3}>Static sites</CardTitle>
        <CardDescription>Astro + Texuli dogfood</CardDescription>
      </CardHeader>
      <CardContent>
        <p>texuli.com ships HTML and CSS. No runtime API calls for the chrome.</p>
      </CardContent>
    </Card>
    <Card variant="elevated">
      <CardHeader>
        <CardTitle level={3}>Media that stays safe</CardTitle>
        <CardDescription>URL policy on every src</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Images, video and generator slots refuse unsafe schemes.</p>
      </CardContent>
    </Card>
  </CardGrid>
</section>

<style>
  .landing {
    display: grid;
    gap: 2rem;
  }
  .hero {
    display: grid;
    gap: 0.75rem;
    padding: 1.5rem;
    border-radius: var(--tx-radius-lg, 0.75rem);
    border: 1px solid var(--tx-border, ButtonBorder);
    background: color-mix(in srgb, var(--tx-primary, Highlight) 8%, var(--tx-surface, Canvas));
  }
  .hero h2 {
    margin: 0;
    font-size: clamp(1.75rem, 5vw, 2.5rem);
    line-height: 1.15;
  }
  .hero p {
    margin: 0;
    max-inline-size: 36rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .hero__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  p {
    margin: 0;
    font-size: 0.95rem;
  }
</style>
