/** One selectable command palette entry (fictional data in demos). */
export type CommandItemData = {
  /** Stable id used as the option value. */
  id: string;
  /** Visible primary label. */
  label: string;
  /** Optional secondary line. */
  description?: string;
  /** Group heading when searching; ignored for recent (uses recentLabel). */
  group?: string;
  keywords?: readonly string[];
  disabled?: boolean;
};

export type CommandPaletteSearch = (
  query: string
) => readonly CommandItemData[] | Promise<readonly CommandItemData[]>;

export type CommandPaletteSelect = (item: CommandItemData) => void;
