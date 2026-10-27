<script lang="ts">
import { Button, ButtonGroup, IconButton } from 'texuli/button';
import { scopedTheme } from '../scoped-theme.ts';

let last = $state('idle');

async function slowSave(): Promise<void> {
  last = 'saving';
  await new Promise((r) => setTimeout(r, 400));
  last = 'saved';
}
</script>

<section data-example="texuli-button" aria-labelledby="tx-button-title">
  <h2 id="tx-button-title">Button</h2>
  <p>
    Variants, sizes, loading, links through the URL policy, groups, RTL and dark
    mode. Fictional example.com only.
  </p>

  <h3>Variants</h3>
  <div class="row" data-axis="variants">
    <Button variant="default">Default</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="outline">Outline</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="destructive">Destructive</Button>
    <Button variant="link" href="https://example.com/docs">Link</Button>
  </div>

  <h3>Sizes</h3>
  <div class="row" data-axis="sizes">
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
    <IconButton label="More actions" variant="outline">
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"
        ><circle cx="8" cy="3" r="1.5" fill="currentColor"></circle><circle
          cx="8"
          cy="8"
          r="1.5"
          fill="currentColor"
        ></circle><circle cx="8" cy="13" r="1.5" fill="currentColor"></circle></svg
      >
    </IconButton>
    <IconButton label="More actions, large" variant="outline" size="lg">
      <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"
        ><circle cx="8" cy="3" r="1.5" fill="currentColor"></circle><circle
          cx="8"
          cy="8"
          r="1.5"
          fill="currentColor"
        ></circle><circle cx="8" cy="13" r="1.5" fill="currentColor"></circle></svg
      >
    </IconButton>
  </div>

  <h3>States</h3>
  <div class="row" data-axis="states">
    <Button disabled>Disabled</Button>
    <Button loading loadingLabel="Saving changes">Save</Button>
    <Button onclick={slowSave}>Async save ({last})</Button>
    <Button href="javascript:alert(1)">Blocked href</Button>
  </div>

  <h3>Group</h3>
  <ButtonGroup label="Text alignment" data-axis="group">
    <Button variant="outline">Start</Button>
    <Button variant="outline">Center</Button>
    <Button variant="outline">End</Button>
  </ButtonGroup>
  <ButtonGroup label="Text alignment, vertical" orientation="vertical" data-axis="group-vertical">
    <Button variant="outline">Start</Button>
    <Button variant="outline">Center</Button>
    <Button variant="outline">End</Button>
  </ButtonGroup>

  <h3>RTL</h3>
  <div class="row" dir="rtl" lang="ar" data-axis="rtl">
    <Button variant="default">حفظ</Button>
    <Button variant="outline">إلغاء</Button>
  </div>

  <h3>Dark</h3>
  <div class="row dark-panel" use:scopedTheme={'dark'} data-axis="dark">
    <Button variant="default">Dark default</Button>
    <Button variant="secondary">Dark secondary</Button>
    <Button variant="outline">Dark outline</Button>
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 1rem;
    padding: 1rem;
    max-inline-size: 48rem;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .dark-panel {
    padding: 0.75rem;
    border-radius: var(--tx-radius, 0.5rem);
  }
</style>
