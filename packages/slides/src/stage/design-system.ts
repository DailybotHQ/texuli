/**
 * The stage's design-system step (ADR-024): a deck's own `designSystem`
 * (`@texuli/deck` model v2). `DeckStageCore` imports this module with
 * `import()` only when a validated deck carries one, so a deck without one
 * never loads it, the player's resolver, the compiler or the runtime
 * (`tests/stage-design-system.test.ts` walks the static graph).
 *
 * Resolution is the player's (`@texuli/player/design-system`): a `ref` goes
 * through the host's resolver (never a fetch; `texuli:<theme>` falls back to
 * the theme library), an inline document compiles at the stage's tier, and
 * every failure is a refusal with a stable code; it never throws.
 *
 * The stage root already carries the deck theme's variables and attributes,
 * so this step does not write on it: it returns plain values (the variables
 * per mode, the scope attributes, the component defaults and the background
 * palette) that the stage renders in place of the theme's, in its own
 * effect and markup. Font faces register once, for host-resolved documents
 * or at the `developer` tier.
 */

import type { DeckBackgroundPalette, DeckDesignSystem } from '@texuli/deck/model';
import {
  type PlayerDesignSystemEvent,
  type PlayerDesignSystems,
  playerDesignDefaults,
  resolvePlayerDesignSystem,
} from '@texuli/player/design-system';
import {
  type ApplicableDesignSystem,
  applyDesignSystem,
  designSystemAppearance,
  isSafeDesignSystemValue,
} from '@texuli/tokens/design-system/apply';
import { deckBackgroundPalette } from './style.ts';

/** The attributes a design system sets on its scope (`DESIGN_SYSTEM_ATTRIBUTES`). */
const ATTRIBUTES = [
  'data-tx-ds',
  'data-tx-ds-version',
  'data-tx-ds-variant',
  'data-tx-surface',
  'data-tx-elevation',
  'data-tx-focus-ring-style',
  'data-tx-icon-style',
] as const;

const HEX = /^#[0-9a-f]{6}$/i;

/** What the stage renders for an applied design system. */
export interface StageDesignSystem {
  readonly id: string;
  /** The compiled modes (`light`, `dark` or both). */
  readonly modes: readonly ('light' | 'dark')[];
  /** The safe variables of a mode (a compiled mode; another falls back to the first). */
  vars(mode: 'light' | 'dark'): Record<string, string>;
  /** The scope attributes (escaped values only). */
  readonly attrs: Readonly<Record<string, string>>;
  /** The component defaults (closed vocabulary), or `undefined`. */
  readonly defaults: Record<string, Record<string, string>> | undefined;
  /** The background palette of a mode (hex only, the neutral palette fills the rest). */
  palette(mode: 'light' | 'dark'): DeckBackgroundPalette;
}

export type StageDesignSystemResult =
  | { event: Extract<PlayerDesignSystemEvent, { status: 'applied' }>; system: StageDesignSystem }
  | { event: Extract<PlayerDesignSystemEvent, { status: 'refused' }>; system?: undefined };

function stageSystem(compiled: ApplicableDesignSystem): StageDesignSystem {
  const modes = (['light', 'dark'] as const).filter((mode) => compiled.vars[mode]);
  const vars = (mode: 'light' | 'dark') => {
    const pick = modes.includes(mode) ? mode : modes[0];
    return pick ? designSystemAppearance(compiled, { mode: pick }).vars : {};
  };
  const attrs: Record<string, string> = {};
  const source = compiled.attrs as Record<string, unknown>;
  for (const name of ATTRIBUTES) {
    const value = name === 'data-tx-ds-variant' ? compiled.variant : source[name];
    if (isSafeDesignSystemValue(value) && value.length <= 128) attrs[name] = value;
  }
  return {
    id: compiled.id,
    modes,
    vars,
    attrs,
    defaults: playerDesignDefaults(compiled),
    palette(mode) {
      const values = vars(mode);
      const theme: Record<string, Record<string, { default: string }>> = { [mode]: {} };
      for (const [name, value] of Object.entries(values)) {
        const role = name.slice(5);
        if (name.startsWith('--tx-') && HEX.test(value)) {
          (theme[mode] as Record<string, { default: string }>)[role] = { default: value };
        }
      }
      return deckBackgroundPalette(theme as never, mode);
    },
  };
}

/**
 * Resolve and compile a deck's design system. `tier` is the stage's paint
 * tier for an inline document; a host-resolved one compiles at `developer`.
 * Never rejects.
 */
export async function loadStageDesignSystem(
  reference: Readonly<DeckDesignSystem>,
  host: PlayerDesignSystems | null | undefined,
  tier: 'developer' | 'untrusted',
  doc?: Document
): Promise<StageDesignSystemResult> {
  const result = await resolvePlayerDesignSystem(
    reference as Parameters<typeof resolvePlayerDesignSystem>[0],
    host,
    tier
  );
  if (!result.ok) {
    const { ok: _ok, ...refusal } = result;
    return { event: { status: 'refused', ...refusal } };
  }
  const { compiled } = result;
  try {
    const system = stageSystem(compiled);
    if (system.modes.length === 0) throw new TypeError('No compiled mode');
    // Register the font faces only: a detached element takes the variables.
    if (doc && (result.source === 'ref' || tier === 'developer') && compiled.fontFaces?.length) {
      applyDesignSystem(doc.createElement('div'), compiled, { mode: system.modes[0] ?? 'light' });
    }
    return { event: { status: 'applied', id: compiled.id, source: result.source }, system };
  } catch (error) {
    return {
      event: {
        status: 'refused',
        code: 'design-system-refused',
        path: '$.designSystem',
        message:
          error instanceof Error ? error.message.slice(0, 200) : 'The design system was refused.',
      },
    };
  }
}
