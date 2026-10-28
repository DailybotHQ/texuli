/**
 * A Svelte action that writes CSS custom properties through the CSSOM (never a
 * `style` attribute, so a strict style CSP holds) and removes the ones a
 * later update drops. Only `--tx-*` names are written: values come from the
 * engine resolvers (computed colors, numbers and enum keywords), never from
 * author strings.
 */
type Vars = Readonly<Record<string, string>> | null | undefined;

function apply(node: HTMLElement, previous: Vars, next: Vars): void {
  for (const name of Object.keys(previous ?? {})) {
    if (!next || !Object.hasOwn(next, name)) node.style.removeProperty(name);
  }
  for (const [name, value] of Object.entries(next ?? {})) {
    if (!name.startsWith('--tx-') || typeof value !== 'string') continue;
    if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
  }
}

export function deckCssVars(node: HTMLElement, vars: Vars) {
  let current = vars;
  apply(node, undefined, current);
  return {
    update(next: Vars) {
      apply(node, current, next);
      current = next;
    },
    destroy() {
      apply(node, current, undefined);
    },
  };
}
