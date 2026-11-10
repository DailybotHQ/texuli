/**
 * Catalog part → parent ids, declared (0.17.2). A part is a catalog id that ships in its
 * parent's public module (`IMPORTS_BY_ID`, the same ownership data the static locked check
 * reads) and only exists inside it: `list-item` → `list`, `select-trigger` → `select`,
 * `data-dashboard-widget` → `data-dashboard`. A shared hyphen prefix is not a relation:
 * `alert-dialog`, `icon-button`, `avatar-group-grid`, `text-counter`, `code-field`,
 * `form-field` and `form-submit` are their own ids. Used by the locked render mapper
 * (`@texuli/tools/ds-check`, which keeps the same table and is tested against this one).
 */
export const CATALOG_PART_PARENTS: Readonly<Record<string, string>> = Object.freeze({
  'button-group': 'button',
  'context-menu-trigger': 'context-menu',
  'data-dashboard-widget': 'data-dashboard',
  'dropdown-menu-content': 'dropdown-menu',
  'dropdown-menu-item': 'dropdown-menu',
  'dropdown-menu-trigger': 'dropdown-menu',
  'field-error': 'field',
  'hover-card-content': 'hover-card',
  'input-group': 'input',
  'list-item': 'list',
  'menubar-trigger': 'menubar',
  'popover-content': 'popover',
  'radio-group': 'radio',
  'select-content': 'select',
  'select-group': 'select',
  'select-item': 'select',
  'select-label': 'select',
  'select-portal': 'select',
  'select-separator': 'select',
  'select-trigger': 'select',
  'select-value': 'select',
  'select-viewport': 'select',
});

/**
 * The declared part → parent pairs whose part and parent are both in `ids` (the catalog's
 * id list). Never inferred from a hyphen prefix.
 */
export function partParentMap(ids: readonly string[]): Readonly<Record<string, string>> {
  const known = new Set(ids.filter((id) => typeof id === 'string' && id.length > 0));
  const map: Record<string, string> = {};
  for (const [part, parent] of Object.entries(CATALOG_PART_PARENTS))
    if (known.has(part) && known.has(parent)) map[part] = parent;
  return map;
}
