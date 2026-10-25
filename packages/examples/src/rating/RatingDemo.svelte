<script lang="ts">
import { Rating } from 'texuli/rating';

let service = $state(4);
let food = $state(3.5);
let delivery = $state(0);
</script>

<section data-example="texuli-rating" aria-labelledby="rating-demo-title" class="demo">
  <h2 id="rating-demo-title">Rating</h2>

  <div class="group">
    <h3>Input</h3>
    <Rating bind:value={service} showValue labels={{ label: 'Service at Harbor Notes Cafe' }} />
    <Rating bind:value={food} allowHalf showValue labels={{ label: 'Food (half stars)' }} />
    <Rating bind:value={delivery} clearable showValue labels={{ label: 'Delivery (click again to clear)' }} />
  </div>

  <div class="group">
    <h3>Sizes and tones</h3>
    <Rating value={3} size="sm" labels={{ label: 'Small, warning' }} />
    <Rating value={3} size="md" tone="primary" labels={{ label: 'Medium, primary' }} />
    <Rating value={3} size="lg" tone="neutral" labels={{ label: 'Large, neutral' }} />
  </div>

  <div class="group">
    <h3>States</h3>
    <Rating value={4} readonly labels={{ label: 'Read-only' }} />
    <Rating value={2} disabled labels={{ label: 'Disabled' }} />
    <Rating value={0} max={10} labels={{ label: 'Ten stars, not rated' }} showValue />
  </div>

  <div class="group">
    <h3>Display</h3>
    <Rating display value={4.3} showValue labels={{ display: 'Rated {value} out of {max} by 128 fictional guests' }} />
    <Rating display value={2.7} size="lg" tone="primary" showValue />
  </div>

  <div class="group" dir="rtl" lang="ar">
    <h3>RTL</h3>
    <Rating value={2.5} allowHalf showValue locale="ar-EG" labels={{ label: 'التقييم', item: '{value} من {max} نجوم', summary: '{value} من {max}' }} />
    <Rating display value={3.5} locale="ar-EG" labels={{ display: 'التقييم {value} من {max}' }} />
  </div>
</section>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
    max-inline-size: 48rem;
    padding: 1.5rem;
  }
  .demo h2,
  .demo h3 {
    margin: 0;
  }
  .group {
    display: grid;
    gap: 1rem;
    justify-items: start;
  }
</style>
