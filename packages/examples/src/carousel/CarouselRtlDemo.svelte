<script lang="ts">
import { Carousel } from 'texuli';
import SlideCard from './SlideCard.svelte';
import { DESTINATIONS_AR, type DemoSlide } from './slides.ts';

const arabic = {
  carousel: 'عرض الشرائح',
  slides: 'الشرائح',
  previous: 'الشريحة السابقة',
  next: 'الشريحة التالية',
  goTo: 'انتقل إلى الشريحة {index}: {label}',
  slide: '{index} من {total}: {label}',
  status: 'الشريحة {index} من {total}',
  count: '{index} من {total}',
  play: 'تشغيل العرض التلقائي',
  pause: 'إيقاف العرض التلقائي',
};
</script>

<div class="demo" dir="rtl" lang="ar">
  <Carousel items={[...DESTINATIONS_AR]} messages={arabic} label="وجهات مختارة" controls="overlay">
    {#snippet children(item)}
      <SlideCard slide={item as DemoSlide} />
    {/snippet}
  </Carousel>
</div>

<style>
  .demo {
    max-inline-size: 36rem;
  }
</style>
