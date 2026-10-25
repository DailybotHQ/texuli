<script lang="ts">
import { AspectRatio, Separator, VisuallyHidden } from 'texuli/separator-aspect';
</script>

<section data-example="texuli-separator-aspect" aria-labelledby="tx-sep-aspect-title">
  <h2 id="tx-sep-aspect-title">
    Separator, aspect ratio and visually hidden
    <VisuallyHidden>(layout utilities demo)</VisuallyHidden>
  </h2>
  <p>
    Fictional Harbor Notes chrome only. Separators divide sections; aspect boxes hold media
    placeholders; visually hidden labels stay available to assistive tech.
  </p>

  <h3>Separator — horizontal</h3>
  <div data-axis="separator-horizontal" class="stack">
    <p>Above the line</p>
    <Separator />
    <p>Below the line</p>
    <Separator variant="subtle" />
    <p>Subtle</p>
    <Separator variant="strong" />
    <p>Strong</p>
  </div>

  <h3>Separator — vertical</h3>
  <div data-axis="separator-vertical" class="row">
    <span>Left</span>
    <Separator orientation="vertical" />
    <span>Middle</span>
    <Separator orientation="vertical" variant="strong" decorative={false} />
    <span>Right (semantic)</span>
  </div>

  <h3>AspectRatio</h3>
  <div data-axis="aspect" class="aspect-grid">
    <AspectRatio ratio="16/9" aria-label="16 by 9 preview">
      <span class="placeholder">16:9</span>
    </AspectRatio>
    <AspectRatio ratio="1/1" aria-label="Square preview">
      <span class="placeholder">1:1</span>
    </AspectRatio>
    <AspectRatio ratio="4/3" aria-label="Four by three preview">
      <span class="placeholder">4:3</span>
    </AspectRatio>
    <AspectRatio custom="5 / 4" aria-label="Custom five by four preview">
      <span class="placeholder">5:4 custom</span>
    </AspectRatio>
  </div>

  <h3>RTL</h3>
  <div data-axis="rtl" dir="rtl" lang="ar" class="stack">
    <p>ملاحظات الميناء</p>
    <Separator />
    <AspectRatio ratio="16/9" aria-label="معاينة">
      <span class="placeholder">١٦:٩</span>
    </AspectRatio>
  </div>

  <h3>Dark</h3>
  <div data-axis="dark" data-tx-mode="dark" class="dark-panel stack">
    <p>Dark panel</p>
    <Separator variant="subtle" />
    <AspectRatio ratio="21/9" aria-label="Wide dark preview">
      <span class="placeholder">21:9</span>
    </AspectRatio>
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 1.25rem;
    padding: 1rem;
    max-inline-size: 40rem;
  }

  .stack {
    display: grid;
    gap: 0.75rem;
  }

  .row {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 0.75rem;
    min-block-size: 3rem;
  }

  .aspect-grid {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  }

  .placeholder {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--tx-muted-foreground, CanvasText);
  }

  .dark-panel {
    padding: 1rem;
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background, #0a0a0a);
    color: var(--tx-foreground, #fafafa);
  }
</style>
