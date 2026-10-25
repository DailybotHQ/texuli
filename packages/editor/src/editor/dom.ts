/**
 * Selection sync between the rendered surface and the model
 * (EDITOR_ARCHITECTURE section 3). The surface marks every text block with
 * `data-tx-block`, every void block with `data-tx-void`, every model break
 * with `data-tx-break` and every caret filler with `data-tx-filler`; offsets
 * count UTF-16 units of text nodes plus one per break, the model's units.
 * Subtrees marked `data-tx-skip` (todo checkboxes) never count.
 */
import type { EditorBlockId, EditorPoint, EditorSelection } from '@texuli/core/editor-model';

export const BLOCK_ATTR = 'data-tx-block';
export const VOID_ATTR = 'data-tx-void';

type Leaf = { node: Node; length: number };

const isElement = (node: Node): node is Element => node.nodeType === 1;

/** The counted leaves of a text block element, in document order. */
function leaves(block: Element): Leaf[] {
  const out: Leaf[] = [];
  const visit = (node: Node) => {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3) out.push({ node: child, length: (child as Text).data.length });
      else if (isElement(child)) {
        if (child.hasAttribute('data-tx-skip')) continue;
        if (child.localName === 'br')
          out.push({ node: child, length: child.hasAttribute('data-tx-filler') ? 0 : 1 });
        else visit(child);
      }
    }
  };
  visit(block);
  return out;
}

/** The block's text as the DOM shows it (breaks as `\n`), for the composition diff. */
export function domBlockText(block: Element): string {
  return leaves(block)
    .map(({ node, length }) => (node.nodeType === 3 ? (node as Text).data : length ? '\n' : ''))
    .join('');
}

/** The closest block element around `node`, inside `root`. */
export function blockElementOf(root: Element, node: Node | null): Element | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if (isElement(current) && (current.hasAttribute(BLOCK_ATTR) || current.hasAttribute(VOID_ATTR)))
      return current;
    current = current.parentNode;
  }
  return null;
}

/** The block element for `id`, or `null`. */
export function findBlockElement(root: Element, id: EditorBlockId): Element | null {
  for (const element of root.querySelectorAll(`[${BLOCK_ATTR}],[${VOID_ATTR}]`)) {
    if (element.getAttribute(BLOCK_ATTR) === id || element.getAttribute(VOID_ATTR) === id)
      return element;
  }
  return null;
}

const PRECEDING = 2;

/** The model offset of a DOM point inside a text block element. */
export function offsetInBlock(block: Element, node: Node, offset: number): number {
  const list = leaves(block);
  if (node.nodeType === 3) {
    let count = 0;
    for (const leaf of list) {
      if (leaf.node === node) return count + Math.min(Math.max(0, offset), leaf.length);
      count += leaf.length;
    }
  }
  const boundary = isElement(node) || node.nodeType === 11 ? node.childNodes[offset] : undefined;
  let count = 0;
  for (const leaf of list) {
    const before = boundary
      ? leaf.node !== boundary &&
        !boundary.contains(leaf.node) &&
        (boundary.compareDocumentPosition(leaf.node) & PRECEDING) !== 0
      : node === block ||
        node.contains(leaf.node) ||
        (node.compareDocumentPosition(leaf.node) & PRECEDING) !== 0;
    if (!before) break;
    count += leaf.length;
  }
  return count;
}

/** A DOM point as a model point, or `null` when it is outside every block. */
export function domToPoint(root: Element, node: Node, offset: number): EditorPoint | null {
  let block = blockElementOf(root, node);
  let local: Node = node;
  let localOffset = offset;
  if (!block && (node === root || root.contains(node)) && isElement(node)) {
    // Between blocks: the nearest block after the point, else the last one before it.
    const all = [...root.querySelectorAll(`[${BLOCK_ATTR}]`)];
    const boundary = node.childNodes[offset];
    const after = all.find((element) =>
      boundary
        ? element === boundary ||
          boundary.contains(element) ||
          (boundary.compareDocumentPosition(element) & 4) !== 0
        : false
    );
    if (after) {
      block = after;
      local = after;
      localOffset = 0;
    } else {
      block = all.at(-1) ?? null;
      if (block) {
        local = block;
        localOffset = block.childNodes.length;
      }
    }
  }
  if (!block) return null;
  const id = block.getAttribute(BLOCK_ATTR);
  if (id === null) {
    const voidId = block.getAttribute(VOID_ATTR);
    return voidId === null ? null : { block: voidId, offset: 0 };
  }
  return { block: id, offset: offsetInBlock(block, local, localOffset) };
}

/** A DOM position for a model point inside its block element. */
export function pointToDom(block: Element, offset: number): { node: Node; offset: number } {
  let count = 0;
  for (const leaf of leaves(block)) {
    if (leaf.node.nodeType === 3) {
      if (offset <= count + leaf.length) return { node: leaf.node, offset: offset - count };
    } else if (leaf.length > 0 ? offset === count : true) {
      const parent = leaf.node.parentNode as Node;
      return { node: parent, offset: Array.prototype.indexOf.call(parent.childNodes, leaf.node) };
    }
    count += leaf.length;
  }
  return { node: block, offset: block.childNodes.length };
}

/** Read the DOM selection as a model selection, or `null` when it is not in the surface. */
export function readDomSelection(
  root: Element,
  selection: Selection | null
): EditorSelection | null {
  if (!selection || selection.rangeCount === 0 || !selection.anchorNode || !selection.focusNode)
    return null;
  if (!root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return null;
  const anchorBlock = blockElementOf(root, selection.anchorNode);
  if (
    anchorBlock?.hasAttribute(VOID_ATTR) &&
    anchorBlock === blockElementOf(root, selection.focusNode)
  )
    return { kind: 'node', block: anchorBlock.getAttribute(VOID_ATTR) as string };
  const anchor = domToPoint(root, selection.anchorNode, selection.anchorOffset);
  const focus = domToPoint(root, selection.focusNode, selection.focusOffset);
  if (!anchor || !focus) return null;
  return { kind: 'text', anchor, focus };
}

export const sameSelection = (a: EditorSelection | null, b: EditorSelection | null): boolean => {
  if (!a || !b) return a === b;
  if (a.kind === 'node' || b.kind === 'node')
    return a.kind === b.kind && (a as { block: string }).block === (b as { block: string }).block;
  return (
    a.anchor.block === b.anchor.block &&
    a.anchor.offset === b.anchor.offset &&
    a.focus.block === b.focus.block &&
    a.focus.offset === b.focus.offset
  );
};

/** Write a model selection to the DOM. Returns false when a block is not rendered. */
export function writeDomSelection(
  root: Element,
  selection: EditorSelection,
  domSelection: Selection | null
): boolean {
  if (!domSelection) return false;
  if (sameSelection(readDomSelection(root, domSelection), selection)) return true;
  if (selection.kind === 'node') {
    const element = findBlockElement(root, selection.block);
    const parent = element?.parentNode;
    if (!element || !parent) return false;
    const index = Array.prototype.indexOf.call(parent.childNodes, element);
    domSelection.setBaseAndExtent(parent, index, parent, index + 1);
    return true;
  }
  const anchorBlock = findBlockElement(root, selection.anchor.block);
  const focusBlock =
    selection.focus.block === selection.anchor.block
      ? anchorBlock
      : findBlockElement(root, selection.focus.block);
  if (!anchorBlock || !focusBlock) return false;
  const anchor = pointToDom(anchorBlock, selection.anchor.offset);
  const focus = pointToDom(focusBlock, selection.focus.offset);
  domSelection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
  return true;
}
