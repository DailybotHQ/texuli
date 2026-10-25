/**
 * Fictional map block data on the Port Meridian basemap (not real
 * geography). The demo passes these as untrusted input.
 */

export const DELIVERY_MAP: unknown = {
  type: 'map',
  id: 'delivery-route',
  label: 'Morning delivery route across Port Meridian',
  title: 'Morning delivery route',
  basemap: 'port-meridian',
  points: [
    {
      id: 'depot',
      label: 'North Pier depot',
      lng: -18.6,
      lat: -30.4,
      description: 'Vans leave at 07:00.',
      tone: 'info',
    },
    { id: 'market', label: 'Meridian Center market', lng: -19.1, lat: -30.72, tone: 'success' },
    {
      id: 'bakery',
      label: 'Old Mill bakery',
      lng: -19.2,
      lat: -31.1,
      description: 'Ring at the side door.',
      tone: 'warning',
    },
    { id: 'lighthouse', label: 'Lantern Point lighthouse', lng: -17.8, lat: -31.6, tone: 'danger' },
  ],
  route: ['depot', 'market', 'bakery', 'lighthouse'],
};

/** Rejected: a tile URL as basemap and a script in a field the schema does not know. */
export const HOSTILE_MAP: unknown = {
  type: 'map',
  label: 'Hostile map',
  basemap: 'https://tiles.example.com/{z}/{x}/{y}.png',
  points: [{ id: 'x', label: 'X', lng: -18.6, lat: -30.4, href: 'javascript:alert(1)' }],
};
