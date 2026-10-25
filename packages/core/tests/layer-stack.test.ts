import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bindLayerStackDocument,
  createLayerStack,
  decideEscape,
  getLayerStack,
  isPointerOutsideTopLayer,
  LAYER_STACK_GLOBAL_KEY,
  layerReceivesEscape,
  layerReceivesOutsideInteraction,
  resetLayerStack,
} from '../src/index.ts';

function el(tag = 'div'): HTMLElement {
  return document.createElement(tag);
}

describe('createLayerStack', () => {
  it('registers layers bottom-to-top and reports order', () => {
    const stack = createLayerStack();
    const a = el();
    const b = el();
    const regA = stack.register({ element: a, label: 'dialog' });
    const regB = stack.register({ element: b, label: 'menu' });

    expect(stack.size()).toBe(2);
    expect(stack.list().map((entry) => entry.id)).toEqual([regA.id, regB.id]);
    expect(stack.list()[0]?.label).toBe('dialog');
    expect(stack.top()?.id).toBe(regB.id);
    expect(stack.isTop(regA.id)).toBe(false);
    expect(stack.isTop(regB.id)).toBe(true);
    expect(regA.isTop()).toBe(false);
    expect(regB.isTop()).toBe(true);
    expect(stack.orderOf(regA.id)).toBe(0);
    expect(stack.orderOf(regB.id)).toBe(1);
    expect(regA.order()).toBe(0);
    expect(regB.order()).toBe(1);
  });

  it('unregisters and promotes the layer below to top', () => {
    const stack = createLayerStack();
    const a = stack.register({ element: el() });
    const b = stack.register({ element: el() });
    b.unregister();
    expect(stack.size()).toBe(1);
    expect(stack.top()?.id).toBe(a.id);
    expect(stack.isTop(a.id)).toBe(true);
    // Idempotent unregister.
    b.unregister();
    stack.unregister(b.id);
    expect(stack.size()).toBe(1);
    a.unregister();
    expect(stack.size()).toBe(0);
    expect(stack.top()).toBeNull();
    expect(stack.orderOf(a.id)).toBe(-1);
    expect(a.order()).toBe(-1);
  });

  it('re-registering the same id moves the layer to the top', () => {
    const stack = createLayerStack();
    const first = el();
    const second = el();
    const a = stack.register({ id: 'layer-a', element: first });
    stack.register({ element: second });
    expect(stack.isTop(a.id)).toBe(false);
    const again = stack.register({ id: 'layer-a', element: first, label: 'raised' });
    expect(again.id).toBe('layer-a');
    expect(stack.size()).toBe(2);
    expect(stack.top()?.id).toBe('layer-a');
    expect(stack.top()?.label).toBe('raised');
    expect(stack.list().map((entry) => entry.id)).toEqual([expect.any(String), 'layer-a']);
  });

  it('rejects a non-element root', () => {
    const stack = createLayerStack();
    expect(() => stack.register({ element: null as unknown as Element })).toThrow(/Element/);
  });

  it('clear empties the stack', () => {
    const stack = createLayerStack();
    stack.register({ element: el() });
    stack.register({ element: el() });
    stack.clear();
    expect(stack.size()).toBe(0);
    expect(stack.list()).toEqual([]);
  });
});

describe('getLayerStack shared via globalThis key', () => {
  afterEach(() => {
    resetLayerStack();
  });

  it('returns the same instance for the same global object', () => {
    const scope: { [LAYER_STACK_GLOBAL_KEY]?: ReturnType<typeof createLayerStack> } = {};
    const first = getLayerStack(scope);
    const second = getLayerStack(scope);
    expect(first).toBe(second);
    expect(scope[LAYER_STACK_GLOBAL_KEY]).toBe(first);
  });

  it('shares registrations across getLayerStack calls (islands)', () => {
    const scope = {};
    const islandA = getLayerStack(scope);
    const islandB = getLayerStack(scope);
    const reg = islandA.register({ element: el(), id: 'shared-dialog' });
    expect(islandB.size()).toBe(1);
    expect(islandB.isTop(reg.id)).toBe(true);
    islandB.unregister(reg.id);
    expect(islandA.size()).toBe(0);
  });

  it('resetLayerStack drops the shared instance', () => {
    const scope = {};
    const before = getLayerStack(scope);
    before.register({ element: el() });
    resetLayerStack(scope);
    const after = getLayerStack(scope);
    expect(after).not.toBe(before);
    expect(after.size()).toBe(0);
  });
});

describe('Escape reaches only the topmost layer', () => {
  it('decideEscape returns only the top id for Escape', () => {
    const stack = createLayerStack();
    const lower = stack.register({ element: el() });
    const upper = stack.register({ element: el() });

    expect(decideEscape(stack, { key: 'Escape' })).toEqual({ layerId: upper.id });
    expect(decideEscape(stack, { key: 'Esc' })).toEqual({ layerId: upper.id });
    expect(layerReceivesEscape(stack, upper.id)).toBe(true);
    expect(layerReceivesEscape(stack, lower.id)).toBe(false);
  });

  it('decideEscape ignores other keys, prevented events and an empty stack', () => {
    const stack = createLayerStack();
    expect(decideEscape(stack, { key: 'Escape' })).toBeNull();
    const only = stack.register({ element: el() });
    expect(decideEscape(stack, { key: 'Enter' })).toBeNull();
    expect(decideEscape(stack, { key: 'Escape', defaultPrevented: true })).toBeNull();
    only.unregister();
    expect(decideEscape(stack, { key: 'Escape' })).toBeNull();
  });

  it('after the top unregisters, Escape targets the new top', () => {
    const stack = createLayerStack();
    const lower = stack.register({ element: el() });
    const upper = stack.register({ element: el() });
    upper.unregister();
    expect(decideEscape(stack, { key: 'Escape' })).toEqual({ layerId: lower.id });
    expect(layerReceivesEscape(stack, lower.id)).toBe(true);
  });
});

describe('outside interaction reaches only the topmost layer', () => {
  it('isPointerOutsideTopLayer uses contains and composedPath', () => {
    const stack = createLayerStack();
    const root = el();
    const child = el('button');
    root.append(child);
    document.body.append(root);
    const outside = el();
    document.body.append(outside);
    stack.register({ element: root });

    expect(isPointerOutsideTopLayer(stack, child)).toBe(false);
    expect(isPointerOutsideTopLayer(stack, root)).toBe(false);
    expect(isPointerOutsideTopLayer(stack, outside)).toBe(true);
    expect(isPointerOutsideTopLayer(stack, null)).toBe(true);
    expect(
      isPointerOutsideTopLayer(stack, outside, { composedPath: [outside, document.body] })
    ).toBe(true);
    expect(
      isPointerOutsideTopLayer(stack, outside, { composedPath: [child, root, document.body] })
    ).toBe(false);

    root.remove();
    outside.remove();
  });

  it('layerReceivesOutsideInteraction only names the top layer', () => {
    const stack = createLayerStack();
    const lowerRoot = el();
    const upperRoot = el();
    const outside = el();
    document.body.append(lowerRoot, upperRoot, outside);
    const lower = stack.register({ element: lowerRoot });
    const upper = stack.register({ element: upperRoot });

    expect(layerReceivesOutsideInteraction(stack, outside)).toEqual({ layerId: upper.id });
    expect(layerReceivesOutsideInteraction(stack, upperRoot)).toBeNull();
    // A click inside the lower layer is still outside the top → top receives it.
    expect(layerReceivesOutsideInteraction(stack, lowerRoot)).toEqual({ layerId: upper.id });
    expect(layerReceivesOutsideInteraction(stack, lowerRoot)?.layerId).not.toBe(lower.id);

    upper.unregister();
    expect(layerReceivesOutsideInteraction(stack, outside)).toEqual({ layerId: lower.id });
    expect(layerReceivesOutsideInteraction(stack, lowerRoot)).toBeNull();

    lowerRoot.remove();
    upperRoot.remove();
    outside.remove();
  });

  it('empty stack: outside helpers do not invent a layer', () => {
    const stack = createLayerStack();
    expect(isPointerOutsideTopLayer(stack, el())).toBe(true);
    expect(layerReceivesOutsideInteraction(stack, el())).toBeNull();
  });
});

describe('bindLayerStackDocument', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('routes Escape and outside pointerdown only to the top layer', () => {
    const stack = createLayerStack();
    const lowerRoot = el();
    const upperRoot = el();
    const outside = el();
    document.body.append(lowerRoot, upperRoot, outside);
    const lower = stack.register({ element: lowerRoot });
    const upper = stack.register({ element: upperRoot });

    const escapes: string[] = [];
    const outsides: string[] = [];
    const binding = bindLayerStackDocument(document, stack, {
      onEscape: (layer, event) => {
        escapes.push(layer.id);
        event.preventDefault();
        return true;
      },
      onPointerOutside: (layer) => {
        outsides.push(layer.id);
        return true;
      },
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(escapes).toEqual([upper.id]);
    expect(escapes).not.toContain(lower.id);

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(outsides).toEqual([upper.id]);

    // Inside the top layer: no outside callback.
    upperRoot.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(outsides).toEqual([upper.id]);

    upper.unregister();
    escapes.length = 0;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(escapes).toEqual([lower.id]);

    binding.disconnect();
    escapes.length = 0;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(escapes).toEqual([]);
  });

  it('does not call handlers when defaultPrevented already', () => {
    const stack = createLayerStack();
    stack.register({ element: el() });
    const onEscape = vi.fn();
    const binding = bindLayerStackDocument(document, stack, { onEscape });
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    Object.defineProperty(event, 'defaultPrevented', { get: () => true });
    document.dispatchEvent(event);
    expect(onEscape).not.toHaveBeenCalled();
    binding.disconnect();
  });
});
