import type { GalleryItem } from '@texuli/media/gallery';
import harbor from '../media-image/harbor.svg?url&no-inline';
import city from './city.svg?url&no-inline';
import dunes from './dunes.svg?url&no-inline';
import forest from './forest.svg?url&no-inline';
import lighthouse from './lighthouse.svg?url&no-inline';
import meadow from './meadow.svg?url&no-inline';

/**
 * Fictional illustrations served as relative files, so they pass the default
 * (untrusted) image policy. Sizes match each SVG's own dimensions.
 */
export const GALLERY_SCENES: GalleryItem[] = [
  {
    id: 'harbor',
    src: harbor,
    alt: 'Fishing boats in a harbor at sunset, with a lighthouse on the right',
    width: 1600,
    height: 900,
    caption: 'Harbor at dusk',
    placeholder: { kind: 'color', color: '#1e3a5f' },
  },
  {
    id: 'forest',
    src: forest,
    alt: 'Pine forest climbing a misty hillside',
    width: 800,
    height: 1200,
    caption: 'Ridge trail',
    placeholder: { kind: 'color', color: '#2f6b55' },
  },
  {
    id: 'dunes',
    src: dunes,
    alt: 'Desert dunes under a pale morning sky',
    width: 1200,
    height: 800,
    caption: 'Morning dunes',
    placeholder: { kind: 'color', color: '#d98c4a' },
  },
  {
    id: 'lighthouse',
    src: lighthouse,
    alt: 'A red and white lighthouse on a rocky point',
    width: 900,
    height: 1350,
    caption: 'North point light',
    placeholder: { kind: 'color', color: '#a9c8ef' },
  },
  {
    id: 'meadow',
    src: meadow,
    alt: 'A meadow with wildflowers and a lone oak tree',
    width: 1200,
    height: 1200,
    caption: 'The old oak',
    placeholder: { kind: 'color', color: '#7fb35a' },
  },
  {
    id: 'city',
    src: city,
    alt: 'A city skyline at night with lit windows',
    width: 1600,
    height: 700,
    caption: 'Night shift',
    placeholder: { kind: 'color', color: '#18223d' },
  },
];
