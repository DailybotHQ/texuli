<script lang="ts">
import {
  GeoMap,
  type GeoPointDatum,
  GeoPointMap,
  REGION_TILES,
  WORLD_TILES,
} from '@texuli/charts/geo';

const revenue: Readonly<Record<string, number | null>> = {
  'north-america': 68,
  'northern-europe': 46,
  'eastern-europe': 28,
  'central-asia': 19,
  'east-asia': 79,
  'central-america': 24,
  'western-europe': 62,
  'southern-europe': 39,
  'middle-east': 31,
  'south-asia': 56,
  'south-america': 35,
  'north-africa': null,
  'southeast-asia': 52,
  'sub-saharan-africa': 18,
  oceania: 42,
};

const activity: readonly GeoPointDatum[] = [
  {
    id: 'harbor',
    label: 'Harbor team',
    regionId: 'harbor-point',
    value: 31,
    offset: { x: -0.2, y: 0.1 },
  },
  {
    id: 'quay',
    label: 'Quay team',
    regionId: 'east-quay',
    value: 18,
    offset: { x: 0.18, y: -0.12 },
  },
  { id: 'ridge', label: 'Ridge team', regionId: 'north-ridge', value: 25 },
  { id: 'town', label: 'Town team', regionId: 'old-town', value: 39, offset: { x: 0.2, y: 0.18 } },
  { id: 'mill', label: 'Mill team', regionId: 'mill-district', value: 12 },
  { id: 'tide', label: 'Tide team', regionId: 'tidewater', value: 21 },
];
</script>

<section class="demo" aria-labelledby="geo-demo-title">
  <h2 id="geo-demo-title">Offline geo charts</h2>
  <p>Bundled region tiles are schematic shapes, not precise borders or live map data.</p>
  <section class="mode light" data-tx-mode="light" aria-labelledby="geo-light-title">
    <h3 id="geo-light-title">Light mode</h3>
    <div class="maps">
      <GeoMap title="Revenue by world region" description="Revenue in millions; missing values have a patterned fill." data={revenue} shape={WORLD_TILES} />
      <GeoPointMap title="Team activity by district" description="Marker size shows quarterly activity across fictional Harbor Bay districts." points={activity} shape={REGION_TILES} />
    </div>
  </section>
  <section class="mode dark" data-tx-mode="dark" aria-labelledby="geo-dark-title">
    <h3 id="geo-dark-title">Dark mode</h3>
    <div class="maps">
      <GeoMap title="Revenue by world region" description="Revenue in millions; missing values have a patterned fill." data={revenue} shape={WORLD_TILES} />
      <GeoPointMap title="Team activity by district" description="Marker size shows quarterly activity across fictional Harbor Bay districts." points={activity} shape={REGION_TILES} />
    </div>
  </section>
</section>

<style>
  .demo { display: grid; gap: 1.5rem; }
  .demo > h2, .demo > p, .mode > h3 { margin-block: 0; }
  .mode { border: 1px solid var(--tx-border); border-radius: 0.75rem; padding: 1rem; }
  .mode.light {
    --tx-background: #ffffff;
    --tx-foreground: #17212b;
    --tx-muted-foreground: #465463;
    --tx-muted: #e1e7eb;
    --tx-border: #71808f;
    --tx-primary: #005f73;
    --tx-success: #315c27;
    --tx-info: #164e9b;
    --tx-warning: #784900;
    --tx-destructive: #a62020;
    --tx-secondary: #5d3e8c;
    --tx-accent: #8b3c6c;
    --tx-link: #005ea8;
    --tx-chart-1: #005f73;
    --tx-chart-2: #315c27;
    --tx-chart-3: #164e9b;
    --tx-chart-4: #784900;
    --tx-chart-5: #a62020;
    --tx-chart-6: #5d3e8c;
    --tx-chart-7: #8b3c6c;
    --tx-chart-8: #005ea8;
    --tx-chart-sequential-1: #627b89;
    --tx-chart-sequential-2: #526f7d;
    --tx-chart-sequential-3: #456372;
    --tx-chart-sequential-4: #385766;
    --tx-chart-sequential-5: #2c4d5d;
    --tx-chart-sequential-6: #204356;
    --tx-chart-sequential-7: #16394e;
    --tx-chart-sequential-8: #0c3046;
    --tx-chart-sequential-9: #03283e;
    background: var(--tx-background);
    color: var(--tx-foreground);
  }
  .mode.dark {
    --tx-background: #121820;
    --tx-foreground: #f0f4f8;
    --tx-muted-foreground: #c0ccd8;
    --tx-muted: #2a3540;
    --tx-border: #8394a5;
    --tx-primary: #68d8e8;
    --tx-success: #9bd97d;
    --tx-info: #9fc5ff;
    --tx-warning: #ffd078;
    --tx-destructive: #ff9999;
    --tx-secondary: #d1b4ff;
    --tx-accent: #ffacd8;
    --tx-link: #a7cfff;
    --tx-chart-1: #68d8e8;
    --tx-chart-2: #9bd97d;
    --tx-chart-3: #9fc5ff;
    --tx-chart-4: #ffd078;
    --tx-chart-5: #ff9999;
    --tx-chart-6: #d1b4ff;
    --tx-chart-7: #ffacd8;
    --tx-chart-8: #a7cfff;
    --tx-chart-sequential-1: #8298a8;
    --tx-chart-sequential-2: #91aaba;
    --tx-chart-sequential-3: #a0bdcc;
    --tx-chart-sequential-4: #afcfdd;
    --tx-chart-sequential-5: #bfdeea;
    --tx-chart-sequential-6: #cce6f0;
    --tx-chart-sequential-7: #d5ebf3;
    --tx-chart-sequential-8: #ddf0f6;
    --tx-chart-sequential-9: #e7f5f9;
    background: var(--tx-background);
    color: var(--tx-foreground);
  }
  .maps { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr)); margin-block-start: 1rem; }
  @media (forced-colors: active) { .mode { border-color: CanvasText; } }

  @media (forced-colors: active) {
    .mode, .dark, [data-tx-mode="dark"] {
      background: Canvas !important;
      color: CanvasText !important;
      border-color: CanvasText !important;
      --tx-background: Canvas;
      --tx-foreground: CanvasText;
      --tx-muted-foreground: CanvasText;
      --tx-border: CanvasText;
      --tx-surface: Canvas;
      --tx-primary: Highlight;
      --tx-primary-foreground: HighlightText;
    }
  }
</style>
