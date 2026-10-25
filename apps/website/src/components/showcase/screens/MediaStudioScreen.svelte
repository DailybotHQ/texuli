<script lang="ts">
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'texuli/card';
</script>

<section class="studio" aria-label="Media studio">
  <div class="toolbar">
    <h2 class="title">Composition · Ferry poster</h2>
    <div class="toolbar__actions">
      <Button type="button" size="sm" variant="secondary">Export PNG</Button>
      <Button type="button" size="sm" variant="secondary">Export SVG</Button>
      <Button type="button" size="sm">Export WebM</Button>
    </div>
  </div>
  <div class="layout">
    <Card variant="elevated" class="canvas-card">
      <CardHeader>
        <CardTitle level={3}>Canvas</CardTitle>
        <CardDescription>Static stand-in for composition-canvas</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          class="canvas"
          role="img"
          aria-label="Poster preview: dark harbor silhouette with title Harbor Notes"
        >
          <p class="canvas__title">Harbor Notes</p>
          <p class="canvas__sub">Summer ferry schedule</p>
        </div>
      </CardContent>
    </Card>
    <Card variant="flat">
      <CardHeader>
        <CardTitle level={3}>Layers</CardTitle>
      </CardHeader>
      <CardContent>
        <ul class="layers">
          <li><Badge>Background</Badge> Night gradient</li>
          <li><Badge variant="secondary">Shape</Badge> Harbor silhouette</li>
          <li><Badge variant="outline">Text</Badge> Title lockup</li>
        </ul>
        <p class="note">
          Real export uses <code>@texuli/media/export</code> in the browser — no upload. Generator
          slot hosts supply their own model.
        </p>
      </CardContent>
    </Card>
  </div>
</section>

<style>
  .studio {
    display: grid;
    gap: 1rem;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .title {
    margin: 0;
    font-size: 1.1rem;
  }
  .toolbar__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .layout {
    display: grid;
    gap: 1rem;
  }
  @media (min-width: 48rem) {
    .layout {
      grid-template-columns: minmax(0, 1.6fr) minmax(12rem, 1fr);
    }
  }
  .canvas {
    aspect-ratio: 16 / 10;
    display: grid;
    place-content: center;
    gap: 0.35rem;
    border-radius: var(--tx-radius, 0.5rem);
    background: linear-gradient(
      160deg,
      color-mix(in srgb, var(--tx-primary, Highlight) 35%, #0b1220),
      #0b1220 60%
    );
    color: #f8fafc;
    text-align: center;
    padding: 1rem;
  }
  .canvas__title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }
  .canvas__sub {
    margin: 0;
    opacity: 0.85;
    font-size: 0.95rem;
  }
  .layers {
    list-style: none;
    margin: 0 0 0.75rem;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .note {
    margin: 0;
    font-size: 0.85rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  code {
    font-size: 0.9em;
  }
</style>
