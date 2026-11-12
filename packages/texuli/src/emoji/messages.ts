import type { EmojiCategory } from '@texuli/emojis/catalog';

export type EmojiPickerMessages = {
  picker: string;
  search: string;
  categoriesLabel: string;
  categories: Record<'all' | 'recent' | EmojiCategory, string>;
  skinTone: string;
  tones: Record<'default' | 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark', string>;
  loading: string;
  noResults: string;
};

/** English defaults; hosts may pass a locale-specific dictionary through `messages`. */
export const EMOJI_PICKER_MESSAGES_EN: EmojiPickerMessages = {
  picker: 'Choose an emoji',
  search: 'Search emoji',
  categoriesLabel: 'Emoji categories',
  categories: {
    all: 'All',
    recent: 'Recent',
    'smileys-emotion': 'Smileys',
    'people-body': 'People',
    'animals-nature': 'Animals and nature',
    'food-drink': 'Food and drink',
    'travel-places': 'Travel and places',
    activities: 'Activities',
    objects: 'Objects',
    symbols: 'Symbols',
    flags: 'Flags',
  },
  skinTone: 'Skin tone',
  tones: {
    default: 'Default tone',
    light: 'Light skin tone',
    'medium-light': 'Medium-light skin tone',
    medium: 'Medium skin tone',
    'medium-dark': 'Medium-dark skin tone',
    dark: 'Dark skin tone',
  },
  loading: 'Loading emoji catalog',
  noResults: 'No emoji found.',
};

/** Spanish defaults for hosts that use the built-in Texuli Spanish locale. */
export const EMOJI_PICKER_MESSAGES_ES: EmojiPickerMessages = {
  picker: 'Elegir un emoji',
  search: 'Buscar emoji',
  categoriesLabel: 'Categorías de emoji',
  categories: {
    all: 'Todos',
    recent: 'Recientes',
    'smileys-emotion': 'Emociones',
    'people-body': 'Personas',
    'animals-nature': 'Animales y naturaleza',
    'food-drink': 'Comida y bebida',
    'travel-places': 'Viajes y lugares',
    activities: 'Actividades',
    objects: 'Objetos',
    symbols: 'Símbolos',
    flags: 'Banderas',
  },
  skinTone: 'Tono de piel',
  tones: {
    default: 'Tono predeterminado',
    light: 'Tono de piel claro',
    'medium-light': 'Tono de piel medio claro',
    medium: 'Tono de piel medio',
    'medium-dark': 'Tono de piel medio oscuro',
    dark: 'Tono de piel oscuro',
  },
  loading: 'Cargando catálogo de emoji',
  noResults: 'No se encontraron emoji.',
};
