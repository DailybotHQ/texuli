<script lang="ts">
import { type MapFence, type MapMarker, type MapRoute, MapView } from '@texuli/data/map';

const markers: MapMarker[] = [
  {
    id: 'north-pier',
    lng: -18.6,
    lat: -30.4,
    label: 'North Pier',
    detail: 'Harbor operations · 12 active',
    tone: 'primary',
    shape: 'pin',
    glyph: 'N',
  },
  {
    id: 'meridian-center',
    lng: -19.1,
    lat: -30.72,
    label: 'Meridian Center',
    detail: 'Service hub · 8 active',
    tone: 'success',
    shape: 'square',
    glyph: 'M',
  },
  {
    id: 'old-mill-a',
    lng: -19.2,
    lat: -31.1,
    label: 'Old Mill · East',
    detail: 'Depot · 4 active',
    tone: 'info',
    shape: 'diamond',
    glyph: 'E',
  },
  {
    id: 'old-mill-b',
    lng: -19.203,
    lat: -31.101,
    label: 'Old Mill · West',
    detail: 'Depot · 3 active',
    tone: 'info',
    shape: 'circle',
    glyph: 'W',
  },
  {
    id: 'lantern',
    lng: -17.8,
    lat: -31.6,
    label: 'Lantern Point',
    detail: 'Coastal station · 6 active',
    tone: 'warning',
    shape: 'circle',
    glyph: 'L',
  },
];

const routes: MapRoute[] = [
  {
    id: 'coast-run',
    label: 'Coast run',
    tone: 'primary',
    progress: 0.55,
    stops: [
      { lng: -18.6, lat: -30.4 },
      { lng: -19.1, lat: -30.72 },
      { lng: -17.8, lat: -31.6 },
    ],
  },
];

const fences: MapFence[] = [
  {
    id: 'north-yard',
    name: 'North yard',
    shape: 'polygon',
    tone: 'warning',
    ring: [
      [-18.75, -30.25],
      [-18.45, -30.25],
      [-18.45, -30.55],
      [-18.75, -30.55],
    ],
  },
];
</script>

<section data-example="data-map">
  <header>
    <div>
      <p class="eyebrow">FIELD OPERATIONS / PORT MERIDIAN</p>
      <h2>Harbor coverage</h2>
      <p class="intro">A self-contained map for an offline dispatch workspace.</p>
    </div>
    <div class="summary" aria-label="Coverage summary">
      <span><strong>5</strong> locations</span>
      <span><strong>33</strong> active units</span>
    </div>
  </header>
  <div class="map-host">
    <MapView {markers} {routes} {fences} label="Harbor coverage" listPlacement="side" />
  </div>
  <section dir="rtl" lang="ar" aria-labelledby="map-rtl-title">
    <h3 id="map-rtl-title">التغطية باللغة العربية</h3>
    <p>نسخة RTL للعلامات والمسارات نفسها على الخريطة المحلية.</p>
    <div class="map-host">
      <MapView
        {markers}
        {routes}
        {fences}
        label="تغطية الميناء"
        direction="rtl"
        listPlacement="side"
      />
    </div>
  </section>
</section>

<style>
  section {
    display: grid;
    gap: 1rem;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
  }
  h2 {
    margin: 0.15rem 0 0.25rem;
    font-size: clamp(1.2rem, 2vw, 1.55rem);
    letter-spacing: -0.025em;
  }
  p {
    margin: 0;
  }
  .eyebrow {
    color: var(--tx-primary, #286c84);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.09em;
  }
  .intro {
    color: var(--tx-foreground, CanvasText);
    font-size: 0.82rem;
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }
  .summary span {
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 999px;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
    font-size: 0.72rem;
  }
  .summary strong {
    color: var(--tx-foreground, CanvasText);
  }
  .map-host {
    min-block-size: 22rem;
  }
  h3 {
    margin: 0;
  }
</style>
