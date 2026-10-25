<script lang="ts">
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';

/**
 * Hero: an announcement badge, the headline, a short lead and two actions.
 * Copy-ready: `texuli add badge button`, then adjust the copy, the links and
 * the heading level to your page.
 */
let {
  primaryHref = '#get-started',
  secondaryHref = '#features',
}: { primaryHref?: string; secondaryHref?: string } = $props();
</script>

<section class="hero" aria-labelledby="hero-title">
  <Badge variant="secondary">New: shared notebooks</Badge>
  <h3 id="hero-title" class="hero__title">Notes your whole harbor crew can trust</h3>
  <p class="hero__lead">
    Harbor Notes keeps shift handovers, checklists and incident logs in one place, so the next
    crew starts where the last one stopped.
  </p>
  <div class="hero__actions">
    <Button href={primaryHref}>Start free</Button>
    <Button href={secondaryHref} variant="outline">See features</Button>
  </div>
</section>

<style>
  .hero {
    display: grid;
    justify-items: start;
    gap: 1rem;
    padding-block: clamp(1.5rem, 5vw, 3rem);
  }
  .hero__title {
    margin: 0;
    max-inline-size: 22ch;
    font-size: clamp(1.75rem, 5vw, 2.75rem);
    line-height: 1.15;
  }
  .hero__lead {
    margin: 0;
    max-inline-size: 40rem;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 1.125rem;
  }
  .hero__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
</style>
