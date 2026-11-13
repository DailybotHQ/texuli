/** `@texuli/core/autocomplete-trigger`: trigger detection, insertion and list keys (PLAN_023 T-cmp-chat). */
import { describe, expect, it } from 'vitest';
import {
  applyAutocomplete,
  autocompleteKeyAction,
  findAutocompleteTrigger,
  moveAutocompleteActive,
} from '../src/autocomplete-trigger/index.ts';

const TRIGGERS = [{ char: '@' }, { char: ':', minQuery: 1 }, { char: '/', lineStart: true }];
const at = (text: string) => findAutocompleteTrigger(text, text.length, TRIGGERS);

describe('findAutocompleteTrigger', () => {
  it('finds the trigger the caret is in, after a boundary', () => {
    expect(at('Ask @jo')).toMatchObject({ query: 'jo', start: 4, end: 7, trigger: { char: '@' } });
    expect(at('@')).toMatchObject({ query: '', start: 0 });
    expect(at('(@ana')).toMatchObject({ query: 'ana' });
    expect(at('mail team@example')).toBeNull();
    expect(at('Ask @jo now')).toBeNull();
  });

  it('honours minQuery and lineStart', () => {
    expect(at('smile :')).toBeNull();
    expect(at('smile :sm')).toMatchObject({ query: 'sm' });
    expect(at('/dep')).toMatchObject({ query: 'dep' });
    expect(at('first\n/dep')).toMatchObject({ query: 'dep', start: 6 });
    expect(at('see /dep')).toBeNull();
  });

  it('stays bounded and never throws on odd input', () => {
    expect(at(`@${'a'.repeat(40)}`)).toBeNull();
    expect(
      findAutocompleteTrigger(`@${'a'.repeat(40)}`, 41, [{ char: '@', maxQuery: 64 }])
    ).not.toBeNull();
    for (const [text, caret] of [
      [null, 1],
      ['abc', 9],
      ['abc', -1],
      ['abc', 1.5],
    ] as const)
      expect(findAutocompleteTrigger(text, caret, TRIGGERS)).toBeNull();
    expect(findAutocompleteTrigger('@a', 2, [{ char: '' }, { char: 'ab' }])).toBeNull();
  });
});

describe('applyAutocomplete', () => {
  it('replaces the trigger and query, adding one space unless whitespace follows', () => {
    const text = 'Ask @jo about it';
    const match = findAutocompleteTrigger(text, 7, TRIGGERS);
    expect(match && applyAutocomplete(text, match, '@[Jordan](mention:jordan)')).toEqual({
      text: 'Ask @[Jordan](mention:jordan) about it',
      caret: 29,
    });
    expect(applyAutocomplete('hi :sm', { start: 3, end: 6 }, '\u{1F604}')).toEqual({
      text: 'hi \u{1F604} ',
      caret: 6,
    });
  });
});

describe('list keys (APG combobox, list autocomplete)', () => {
  it('maps keys and wraps the active option', () => {
    expect(
      ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape', 'Home', 'a'].map((key) =>
        autocompleteKeyAction(key)
      )
    ).toEqual(['next', 'previous', 'accept', 'accept', 'close', null, null]);
    expect(autocompleteKeyAction('Enter', { shiftKey: true })).toBeNull();
    expect(autocompleteKeyAction('ArrowDown', { ctrlKey: true })).toBeNull();
    expect(moveAutocompleteActive(2, 3, 'next')).toBe(0);
    expect(moveAutocompleteActive(0, 3, 'previous')).toBe(2);
    expect(moveAutocompleteActive(-1, 3, 'next')).toBe(0);
    expect(moveAutocompleteActive(1, 0, 'next')).toBe(-1);
  });
});
