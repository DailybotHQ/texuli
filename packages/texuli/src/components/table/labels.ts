/** Attribute a cell carries when its stacked label was set by the author. */
export const FIXED_LABEL = 'data-tx-label-fixed';

/**
 * Copies the column header text onto every body and footer cell as
 * `data-label`, which stacked rows show before the value. The last header row
 * of `thead` names the columns, and `colspan` is honored on both sides. A cell
 * with an author label (`FIXED_LABEL`) is left alone; a cell with no header
 * loses any stale label. Returns how many cells were labelled.
 */
export function fillStackLabels(table: HTMLTableElement): number {
  // Plain selectors rather than `rows` / `cells`, which some DOMs leave out.
  const rowsOf = (section: Element | null) =>
    section ? Array.from(section.querySelectorAll(':scope > tr')) : [];
  const cellsOf = (row: Element) => Array.from(row.querySelectorAll(':scope > th, :scope > td'));
  const span = (cell: Element) => Math.max(1, Number(cell.getAttribute('colspan')) || 1);
  const headerRow = rowsOf(table.querySelector(':scope > thead')).at(-1);
  const names: string[] = [];
  for (const cell of headerRow ? cellsOf(headerRow) : []) {
    const name = (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
    for (let column = 0; column < span(cell); column++) names.push(name);
  }
  let labelled = 0;
  for (const section of table.querySelectorAll(':scope > tbody, :scope > tfoot')) {
    for (const row of rowsOf(section)) {
      let column = 0;
      for (const cell of cellsOf(row)) {
        const name = names[column];
        column += span(cell);
        if (cell.hasAttribute(FIXED_LABEL)) continue;
        if (name && span(cell) === 1) {
          if (cell.getAttribute('data-label') !== name) cell.setAttribute('data-label', name);
          labelled++;
        } else if (cell.hasAttribute('data-label')) {
          cell.removeAttribute('data-label');
        }
      }
    }
  }
  return labelled;
}

/** Whether an element's content overflows its box on either axis. */
export function isScrollable(element: HTMLElement): boolean {
  return (
    element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1
  );
}
