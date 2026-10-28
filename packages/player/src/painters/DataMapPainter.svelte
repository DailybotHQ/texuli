<script lang="ts">
import { MapView } from '@texuli/data/map';
import { getPlayerInteraction } from '../context.ts';

/** `data-map`: markers from JSON (lat, lng) on the offline basemap. */
interface Marker {
  id: string;
  label: string;
  lat: number;
  lng: number;
  detail?: string;
  tone?: 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';
}

let {
  label,
  markers,
  listPlacement = 'side',
  txPath,
}: {
  label: string;
  markers: readonly Marker[];
  listPlacement?: 'side' | 'below';
  txPath?: string;
} = $props();

const interaction = getPlayerInteraction();
</script>

<MapView
  {label}
  markers={markers.map((marker) => ({ ...marker }))}
  {listPlacement}
  onSelect={(marker: { id: string }) => {
    if (txPath !== undefined) interaction?.dispatch(txPath, 'select', { value: marker.id });
  }}
/>
