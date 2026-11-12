/** Public, versioned data contract for the generated Texuli Emoji catalog. */
export type EmojiCategory =
  | 'smileys-emotion'
  | 'people-body'
  | 'animals-nature'
  | 'food-drink'
  | 'travel-places'
  | 'activities'
  | 'objects'
  | 'symbols'
  | 'flags';

export type EmojiTone = 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark';

export interface EmojiRecord {
  readonly id: string;
  readonly unicode: string;
  readonly codepoints: readonly string[];
  readonly name: string;
  readonly shortcode: `:${string}:`;
  /** Unqualified compatibility strings imported from the audited legacy catalog. */
  readonly aliases: readonly string[];
  readonly category: EmojiCategory;
  readonly subcategory: string;
  readonly sortOrder: number;
  readonly emojiVersion: string;
  readonly keywords: readonly string[];
  readonly qualificationAliases: readonly string[];
  readonly variantOf?: string;
  readonly variants?: readonly string[];
  readonly tone?: EmojiTone;
  /** False until an original Texuli asset has passed the art review pipeline. */
  readonly artAvailable: false;
}

export interface EmojiCatalog {
  readonly schemaVersion: 'texuli-emoji/v1';
  readonly unicodeEmojiVersion: '18.0';
  readonly cldrVersion: '49';
  readonly catalogVersion: '18.0.0+cldr.49';
  readonly generatedAt: string;
  readonly records: readonly EmojiRecord[];
}

export interface EmojiAliasConflict {
  readonly dialect: 'legacy';
  readonly alias: string;
  readonly candidates: readonly string[];
  readonly permissiveId: string;
  readonly policy: string;
}

export interface EmojiAliasIndex {
  readonly schemaVersion: 'texuli-emoji/v1';
  readonly policy: Readonly<Record<string, string>>;
  readonly migration: Readonly<{
    source: 'universal-emoji-parser@3.0.2';
    sourceRows: number;
    mappedRows: number;
    unmappedUnicode: readonly string[];
  }>;
  readonly dialects: Readonly<Record<'texuli' | 'legacy', Readonly<Record<string, string>>>>;
  /** 3.0.2 catalog slug per id; the legacy writer emits this, not a keyword. */
  readonly slugs: Readonly<Record<string, string>>;
  readonly conflicts: readonly EmojiAliasConflict[];
}
