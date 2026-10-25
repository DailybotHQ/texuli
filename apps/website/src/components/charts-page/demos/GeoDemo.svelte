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

<div class="grid" data-tx-charts-demo="geo">
  <GeoMap
    title="Revenue by world region"
    description="Revenue in millions on schematic world tiles; missing values use a patterned fill. Not precise borders."
    data={revenue}
    shape={WORLD_TILES}
  />
  <GeoPointMap
    title="Team activity by district"
    description="Marker size shows quarterly activity across fictional Harbor Bay districts."
    points={activity}
    shape={REGION_TILES}
  />
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    gap: 1.25rem;
  }
</style>
