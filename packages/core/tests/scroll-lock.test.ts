import { afterEach, describe, expect, it, vi } from 'vitest';
import { lockScroll } from '../src/index.ts';

const restoreProperties: (() => void)[] = [];
const unlockers: (() => void)[] = [];

function overrideProperty(target: object, key: PropertyKey, value: unknown): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value });
  restoreProperties.push(() => {
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  });
}

function setViewport(width: number, clientWidth: number): void {
  overrideProperty(window, 'innerWidth', width);
  overrideProperty(document.documentElement, 'clientWidth', clientWidth);
}

function acquire(document: Document): () => void {
  const unlock = lockScroll(document);
  unlockers.push(unlock);
  return unlock;
}

afterEach(() => {
  for (const unlock of unlockers.splice(0).reverse()) unlock();
  for (const restore of restoreProperties.splice(0).reverse()) restore();
  document.body.removeAttribute('style');
  document.documentElement.removeAttribute('style');
  vi.restoreAllMocks();
});

describe('lockScroll', () => {
  it('hides page overflow, compensates the measured gutter and restores exact inline styles, and 3 related cases', () => {
    {
      // hides page overflow, compensates the measured gutter and restores exact inline styles
      setViewport(1000, 980);
      document.body.setAttribute('style', 'overflow: clip; padding-inline-end: 4px !important');
      document.documentElement.setAttribute(
        'style',
        'overflow: auto; overscroll-behavior: auto; border-inline-start: 2px solid; border-inline-end: 3px solid'
      );
      vi.spyOn(window, 'getComputedStyle').mockImplementation(
        (element) =>
          ({
            scrollbarGutter: 'auto',
            borderInlineStartWidth: element === document.documentElement ? '2px' : '0px',
            borderInlineEndWidth: element === document.documentElement ? '3px' : '0px',
            paddingInlineEnd: element === document.body ? '4px' : '0px',
          }) as CSSStyleDeclaration
      );

      const unlock = acquire(document);

      expect(document.documentElement.style.getPropertyValue('overflow')).toBe('hidden');
      expect(document.documentElement.style.getPropertyValue('overscroll-behavior')).toBe('none');
      expect(document.body.style.getPropertyValue('overflow')).toBe('hidden');
      expect(document.body.style.getPropertyValue('padding-inline-end')).toBe('19px');
      expect(document.body.style.getPropertyPriority('padding-inline-end')).toBe('important');

      unlock();

      expect(document.documentElement.style.getPropertyValue('overflow')).toBe('auto');
      expect(document.documentElement.style.getPropertyValue('overscroll-behavior')).toBe('auto');
      expect(document.documentElement.style.getPropertyValue('border-inline-start')).toBe(
        '2px solid'
      );
      expect(document.body.style.getPropertyValue('overflow')).toBe('clip');
      expect(document.body.style.getPropertyValue('padding-inline-end')).toBe('4px');
      expect(document.body.style.getPropertyPriority('padding-inline-end')).toBe('important');
    }
    for (const unlock of unlockers.splice(0).reverse()) unlock();
    for (const restore of restoreProperties.splice(0).reverse()) restore();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
    vi.restoreAllMocks();
    {
      // does not add padding when stable scrollbar-gutter already reserves the space
      setViewport(1000, 980);
      document.body.style.setProperty('scrollbar-gutter', 'stable both-edges');
      document.body.style.setProperty('padding-inline-end', '6px');

      const unlock = acquire(document);

      expect(document.body.style.getPropertyValue('padding-inline-end')).toBe('6px');
      unlock();
      expect(document.body.style.getPropertyValue('padding-inline-end')).toBe('6px');
    }
    for (const unlock of unlockers.splice(0).reverse()) unlock();
    for (const restore of restoreProperties.splice(0).reverse()) restore();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
    vi.restoreAllMocks();
    {
      // keeps the page locked until every nested lock is released
      const first = acquire(document);
      const second = acquire(document);

      first();
      expect(document.documentElement.style.getPropertyValue('overflow')).toBe('hidden');
      first();
      expect(document.documentElement.style.getPropertyValue('overflow')).toBe('hidden');

      second();
      expect(document.documentElement.style.getPropertyValue('overflow')).toBe('');
      expect(document.body.style.getPropertyValue('overflow')).toBe('');
    }
    for (const unlock of unlockers.splice(0).reverse()) unlock();
    for (const restore of restoreProperties.splice(0).reverse()) restore();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
    vi.restoreAllMocks();
    {
      // tracks locks independently for each document
      const otherDocument = document.implementation.createHTMLDocument('other');
      const unlockMain = acquire(document);
      const unlockOther = acquire(otherDocument);

      unlockMain();
      expect(document.documentElement.style.getPropertyValue('overflow')).toBe('');
      expect(otherDocument.documentElement.style.getPropertyValue('overflow')).toBe('hidden');

      unlockOther();
      expect(otherDocument.documentElement.style.getPropertyValue('overflow')).toBe('');
    }
  });
  it('fixes the body on iOS and restores the saved scroll position on final release; returns a safe no-op cleanup when the document has no body', () => {
    {
      // fixes the body on iOS and restores the saved scroll position on final release
      setViewport(390, 390);
      overrideProperty(
        window.navigator,
        'userAgent',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'
      );
      overrideProperty(window, 'scrollX', 12);
      overrideProperty(window, 'scrollY', 72);
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

      const unlock = acquire(document);
      const unlockNested = acquire(document);

      expect(document.body.style.getPropertyValue('position')).toBe('fixed');
      expect(document.body.style.getPropertyValue('top')).toBe('-72px');
      unlock();
      expect(scrollTo).not.toHaveBeenCalled();
      expect(document.body.style.getPropertyValue('position')).toBe('fixed');
      unlockNested();

      expect(document.body.style.getPropertyValue('position')).toBe('');
      expect(document.body.style.getPropertyValue('top')).toBe('');
      expect(scrollTo).toHaveBeenCalledWith(12, 72);
    }
    for (const unlock of unlockers.splice(0).reverse()) unlock();
    for (const restore of restoreProperties.splice(0).reverse()) restore();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
    vi.restoreAllMocks();
    {
      // returns a safe no-op cleanup when the document has no body
      const emptyDocument = document.implementation.createHTMLDocument('empty');
      emptyDocument.documentElement.removeChild(emptyDocument.body);

      expect(() => lockScroll(emptyDocument)()).not.toThrow();
    }
  });
});
