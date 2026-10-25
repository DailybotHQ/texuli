# Style presets

`@texuli/tokens/style-presets` provides named, framework-free choices for
density, radius, elevation, motion, type scale, and system-first font pairings.
`stylePresetInput()` converts selected ids into fields accepted by the theme
contract; `applyStylePresets()` validates the result and preserves theme fields
that the selection leaves alone.

```ts
import { applyStylePresets } from '@texuli/tokens/style-presets';

const styled = applyStylePresets(theme, {
  density: 'comfortable',
  radius: 'round',
  typeScale: 'default',
  font: 'system',
  motion: 'standard',
});
```

Density is one global scalar clamped to `0.75`–`1.25`. `densityTargetSize()`
scales a preferred square target size but never returns less than 24 px; its
default preferred target is 44 px. Consumers should apply that size to both
inline and block dimensions of interactive targets, and may choose a larger
preferred size for comfortable touch use.

The four motion presets are `none`, `subtle`, `standard`, and `expressive`.
Passing `reducedMotion: true` to a selection overrides any chosen motion with
zero durations. The CSS layer is responsible for applying the user's system
reduced-motion preference globally.

Font pairings use installed system font stacks and do not fetch fonts. An app
may explicitly call `loadVariableFont()` for a same-origin `.woff2` asset it
ships itself. It never loads a remote font, and requires a `Document` when
called in an environment without a browser global.

All presets expose stable ids and English labels/descriptions. WCAG 2.x is the
contrast standard for this package; APCA is not part of this API.
