# Motion: the motion prop and MotionProvider

**Package:** `texuli`
**Subpath:** `texuli/motion` (the root barrel re-exports `MotionProvider`,
`MOTION_PRESETS` and the types)
**Source:** `packages/texuli/src/motion/`
**Tests:** `packages/texuli/tests/motion.test.ts`,
`packages/data/tests/motion.test.ts`, `tests/behavior/motion.spec.ts`
**Decision:** [ADR-013](../../../docs/DECISIONS.md#adr-013-motion-runtime-web-animations-with-an-owned-spring-solver)

Styled components animate through the shared runtime,
[`@texuli/core/motion`](../../core/docs/core-motion.md) (Web Animations,
reduced motion instant by construction). Each component that moves takes one
`motion` prop; a `MotionProvider` sets the level for everything below it.

## The motion prop

```svelte
<Dialog title="Edit crew" motion={{ enter: 'rise', exit: 'fade', duration: 'slow' }} />
<Popover.Content motion={false} />
<Tabs {items} motion={{ layout: false }} />
```

| Field | Values | Meaning |
| --- | --- | --- |
| `enter` | `fade`, `rise`, `scale`, `slide-start`, `slide-end`, or `false` | How it appears |
| `exit` | the same | How it leaves; it stays mounted, `inert`, until the exit ends |
| `layout` | `boolean` | Layout animation: reorders, inserts and removes (FLIP), the tabs indicator, accordion height |
| `duration` | `fast`, `base`, `slow` | The theme's `--tx-motion-<step>` token |

`motion={false}` turns every part off. Omitted fields keep the component's
default. The names are the closed vocabulary of the blueprint spec 0.6.0
(`SPEC_MOTION_PRESETS` and `SPEC_MOTION_DURATIONS` in `@texuli/spec/motion`;
a test keeps them equal), so an agent's motion data and a component's prop
speak the same words. Nothing here is CSS, keyframes or milliseconds:
unknown names fall back to the default.

`slide-start` comes from the inline start (the right in right-to-left
text). A sheet's slide comes from the edge it is attached to, the whole way.

## Components that animate

| Component | Default |
| --- | --- |
| `Dialog`, `AlertDialog` | panel `scale` in and out (`base`), backdrop `fade` |
| `Sheet`, `Drawer`, `DetailPanel`, `ResponsiveModal` contents | slide from the attached edge (`rise` when centered); `Sheet.Overlay` fades |
| `Popover.Content` | `scale` in and out (`fast`) |
| `HoverCard.Content`, menu contents (`DropdownMenu`, `ContextMenu`, `Menubar`, submenus), `Tooltip` | `scale` in, `fade` out (`fast`) |
| `Toaster` | new toasts rise from the stack's edge, a dismissed one fades out, the stack reflows (`layout`) |
| `Tabs` | the active indicator glides to the new tab (`layout`) |
| `Accordion` | panels animate their height open and closed (`layout`) |
| `Board`, `DataGrid` (`@texuli/data`) | cards and rows glide to their new place (`layout`) |

## MotionProvider

```svelte
<script>
  import { MotionProvider } from 'texuli/motion';
</script>

<MotionProvider level="subtle">
  <App />
</MotionProvider>
```

| Prop | Values | Meaning |
| --- | --- | --- |
| `level` | `full` (default), `subtle`, `none` | The deck's levels: `subtle` shortens durations and drops travel and scale; `none` is instant |
| `reducedMotion` | `true`, `false`, or omitted | `true` forces reduced motion (instant), `false` ignores the reader's preference; omitted follows `prefers-reduced-motion` |

It renders no element. A nested provider can only lower its parent's level
(the host's choice wins), and a parent that forces reduced motion wins over
a child that ignores it. `getMotionSettings()` reads the enclosing settings
during component init.

## Rules every component keeps

- **Nothing on the server or on hydration.** The server paints the end
  state; content present at the first render (an overlay open on load, the
  first toasts, the initial list) never animates in.
- **Reduced motion and level `none` are instant.** Under
  `prefers-reduced-motion: reduce`, a provider's `reducedMotion`, level
  `none` or `motion={false}`, every change commits at once: no frames run and
  a closed part unmounts at once.
- **Focus and inert do not wait for an exit.** An overlay releases the page
  (focus returns, `inert` lifts, it leaves the layer stack and stops
  dismissing) when it closes; only the paint (the top layer, the scroll lock)
  waits for the exit to end, at most 1.2 s.
- **No lasting inline style.** Animations use `fill: "none"`; the end state
  lives in classes and attributes. The tabs indicator is a temporary element
  that leaves when it lands.
- **The runtime is a separate chunk.** `texuli/motion` is small; the runtime
  (`runtime.ts` on `@texuli/core/motion`) loads in the browser once a
  component that can animate mounts. A change that happens before it has
  loaded commits at once (no late flash).

## Seams for other packages

`createOverlayMotion`, `createPresenceMotion`, `createListMotion`,
`createIndicatorMotion` and `createSizeMotion` build the hooks a component
hands its primitive or plays itself (call them during component init; they
read the enclosing provider). `@texuli/data` uses `createListMotion` for the
Board and the DataGrid. Overlay primitives take the hooks as `motionHooks`
([prim-dialog](../../primitives/docs/prim-dialog.md#motion-hooks)).

## Not covered yet

- `Collapsible`, `NavigationMenu`, `Select`, `Combobox`, `CommandPalette`,
  the `Drawer` backdrop (`Drawer.Overlay` is the unstyled primitive one) and
  the layout drawers do not take `motion` yet (planned).
- Shared-element transitions between components and springs in the motion
  prop are planned; the runtime has them (`createSharedElements`, `spring`).
