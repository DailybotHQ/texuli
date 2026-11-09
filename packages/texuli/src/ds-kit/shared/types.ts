/**
 * Types of `texuli/ds-kit` (kit API, `decisions/kit-api.md` §3 and §11). The catalog and
 * allow-manifest types are structural, so `texuli` needs no `@texuli/spec` dependency:
 * `@texuli/spec`'s `SpecCatalog` is assignable to {@link KitCatalog}.
 */
import type { CompiledDesignSystem } from '@texuli/tokens/design-system/compile-core';
import type { DesignSystem } from '@texuli/tokens/design-system/validate';
import type { Snippet } from 'svelte';

export type KitMode = 'light' | 'dark';
export type KitModeView = 'both' | KitMode;
export type KitSectionId = 'foundations' | 'voice' | 'matrix' | 'library' | 'changes';
export type KitAxis = 'variant' | 'size' | 'tone' | 'density';
export type KitState =
  | 'hover'
  | 'focus-visible'
  | 'active'
  | 'disabled'
  | 'loading'
  | 'invalid'
  | 'selected'
  | 'expanded'
  | 'checked'
  | 'open'
  | 'readonly';

/** What the kit reads from a compiled design system (a cached JSON copy works). */
export type KitCompiled = Pick<
  CompiledDesignSystem,
  'id' | 'version' | 'name' | 'modes' | 'vars' | 'fontFaces' | 'assets' | 'accessibility' | 'report'
> & { variant?: string };

/** The subset of `components.json` the kit reads. */
export interface KitCatalog {
  readonly catalogHash: string;
  readonly components: readonly {
    readonly id: string;
    readonly label: string;
    readonly summary: string;
    readonly group: string;
    readonly props: readonly {
      readonly name: string;
      readonly kind: string;
      readonly enumValues?: readonly string[];
    }[];
    readonly axes?: Readonly<
      Partial<Record<KitAxis, { prop: string; values: readonly string[]; default: string }>>
    >;
    readonly states?: readonly KitState[];
  }[];
}

/**
 * The allow manifest (T-t1-compile) as the kit reads it. Provisional until T-t1-compile names
 * its type (kit API §3).
 */
export interface KitAllowManifest {
  readonly version: string;
  readonly contentHash?: string;
  /** Omitted: unlocked, every catalog id allowed. */
  readonly allow?: Readonly<
    Record<
      string,
      {
        readonly variants?: readonly string[];
        readonly sizes?: readonly string[];
        readonly tones?: readonly string[];
        readonly densities?: readonly string[];
        readonly states?: readonly KitState[];
      }
    >
  >;
  readonly library?: readonly string[];
}

/** One library entry, as the document declares it. */
export type KitLibraryEntry = NonNullable<DesignSystem['library']>[number];

/** The library snippet signature (kit API §11.5). */
export type KitLibrarySnippet = Snippet<
  [{ id: string; entry: KitLibraryEntry; variant?: string; mode: KitMode }]
>;

export interface KitSampleContext {
  readonly id: string;
  readonly mode: KitMode;
  readonly props: Readonly<Record<string, string | boolean>>;
  readonly state?: KitState;
  readonly attributes: Readonly<Record<string, string>>;
}

export interface DesignSystemKitProps {
  /** The source document (voice, allow, library and approval live only here). Untrusted data. */
  document: DesignSystem;
  /** Its compiled output (`compileDesignSystem`). The foundations need it. */
  compiled?: KitCompiled;
  /** The resolved allow manifest. */
  allow?: KitAllowManifest;
  /** The catalog vocabulary (`@texuli/spec/catalog/components.json`), as data. */
  catalog?: KitCatalog;
  /** The version to compare against (Changes). */
  previous?: { document: DesignSystem; compiled?: KitCompiled };
  /** Live previews of the design system's own components, keyed by library id. */
  library?: Readonly<Record<string, KitLibrarySnippet>>;
  /** Live samples for catalog ids the kit cannot import, keyed by catalog id. */
  samples?: Readonly<Record<string, Snippet<[KitSampleContext]>>>;
  /** Components: `grid` (default, variants × sizes plus strips) or `full` (the capped product). */
  matrix?: 'grid' | 'full';
  /** List the components the design system does not allow (never as samples). Default true. */
  showDisallowed?: boolean;
  /** Which sections, in which order. Default: every section the kit can show. */
  sections?: readonly KitSectionId[];
  /** Light and dark side by side, or one mode (bindable). Default `both`. */
  modeView?: KitModeView;
  /** The current section (controlled navigation, kit API §11.1). Omitted: uncontrolled. */
  currentSection?: KitSectionId;
  /** The current item in that section (a stable item id, e.g. a token group or catalog id). */
  currentItem?: string;
  /**
   * Called when the reader picks a section or item in the kit's navigation. When set, the kit
   * leaves the URL to the host (a hash router) and does not follow the link itself.
   */
  onNavigate?: (section: KitSectionId, item?: string) => void;
  /** Prefix of every `id` the kit renders (deep links). Default `tx-ds-kit`. */
  idPrefix?: string;
  /** Heading level of the kit title (sections use the next level). Default 2. */
  headingLevel?: 2 | 3;
  /** Accessible name of the kit. Default: the document's name. */
  label?: string;
  class?: string;
}
