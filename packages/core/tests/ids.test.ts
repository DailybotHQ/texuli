import { describe, expect, it } from 'vitest';
import {
  ariaControls,
  ariaDescribedBy,
  ariaLabelledBy,
  createIdFamily,
  createIdScope,
  ensureElementId,
  joinIds,
  sanitizeIdPart,
} from '../src/index.ts';

describe('createIdScope', () => {
  it('issues deterministic ids from a stable prefix and counter', () => {
    const ids = createIdScope({ prefix: 'dialog' });
    expect(ids.next()).toBe('dialog-0');
    expect(ids.next()).toBe('dialog-1');
    expect(ids.next('title')).toBe('dialog-2-title');
    expect(ids.count).toBe(3);
    expect(ids.cursor).toBe(3);
  });

  it('matches SSR and hydration when options and call order match', () => {
    const server = createIdScope({ prefix: 'tx', start: 0 });
    const client = createIdScope({ prefix: 'tx', start: 0 });

    const serverIds = [server.next('root'), server.next('label'), server.next('hint')];
    const clientIds = [client.next('root'), client.next('label'), client.next('hint')];

    expect(clientIds).toEqual(serverIds);
    expect(serverIds).toEqual(['tx-0-root', 'tx-1-label', 'tx-2-hint']);
  });

  it('isolates counters per root so parallel scopes do not collide by counter', () => {
    const a = createIdScope({ prefix: 'a' });
    const b = createIdScope({ prefix: 'b' });
    expect(a.next()).toBe('a-0');
    expect(b.next()).toBe('b-0');
    expect(a.next()).toBe('a-1');
  });

  it('defaults the prefix to tx and start to 0', () => {
    const ids = createIdScope();
    expect(ids.prefix).toBe('tx');
    expect(ids.next()).toBe('tx-0');
  });

  it('sanitizes hostile or empty prefixes instead of using Math.random', () => {
    expect(createIdScope({ prefix: '' }).prefix).toBe('tx');
    expect(createIdScope({ prefix: '$$$' }).prefix).toBe('tx');
    expect(createIdScope({ prefix: ' My Dialog! ' }).next()).toBe('My-Dialog-0');
    expect(createIdScope({ prefix: '9bad' }).next()).toBe('_9bad-0');
  });

  it('treats non-finite or negative start as 0', () => {
    expect(createIdScope({ start: Number.NaN }).next()).toBe('tx-0');
    expect(createIdScope({ start: -3 }).next()).toBe('tx-0');
    expect(createIdScope({ start: 4.9 }).next()).toBe('tx-4');
  });

  it('resets the counter to the original start', () => {
    const ids = createIdScope({ prefix: 'x', start: 2 });
    expect(ids.next()).toBe('x-2');
    expect(ids.next()).toBe('x-3');
    ids.reset();
    expect(ids.count).toBe(0);
    expect(ids.cursor).toBe(2);
    expect(ids.next()).toBe('x-2');
  });

  it('drops empty part names and sanitizes slot names', () => {
    const ids = createIdScope({ prefix: 'f' });
    expect(ids.next('')).toBe('f-0');
    expect(ids.next('  ')).toBe('f-1');
    expect(ids.next('error message!')).toBe('f-2-error-message');
  });
});

describe('sanitizeIdPart', () => {
  it('returns empty for blank input and strips unsafe characters', () => {
    expect(sanitizeIdPart('')).toBe('');
    expect(sanitizeIdPart('   ')).toBe('');
    expect(sanitizeIdPart('a b/c')).toBe('a-b-c');
    expect(sanitizeIdPart('12')).toBe('_12');
  });
});

describe('createIdFamily', () => {
  it('builds related ids from one counter step', () => {
    const ids = createIdScope({ prefix: 'field' });
    const family = createIdFamily(ids, ['label', 'hint', 'error']);
    expect(family).toEqual({
      label: 'field-0-label',
      hint: 'field-0-hint',
      error: 'field-0-error',
    });
    expect(ids.next()).toBe('field-1');
  });

  it('skips empty parts without leaving holes in the record keys', () => {
    const ids = createIdScope();
    const family = createIdFamily(ids, ['ok', '', '$$$']);
    expect(family).toEqual({ ok: 'tx-0-ok' });
  });
});

describe('aria linking helpers', () => {
  it('joinIds drops falsy tokens and returns undefined when empty', () => {
    expect(joinIds()).toBeUndefined();
    expect(joinIds(null, undefined, false, '')).toBeUndefined();
    expect(joinIds('a', null, ' b ', false, '')).toBe('a b');
  });

  it('ariaLabelledBy, ariaDescribedBy and ariaControls share join semantics', () => {
    expect(ariaLabelledBy('title', 'subtitle')).toBe('title subtitle');
    expect(ariaDescribedBy(undefined, 'hint')).toBe('hint');
    expect(ariaControls('panel-1', 'panel-2')).toBe('panel-1 panel-2');
    expect(ariaLabelledBy()).toBeUndefined();
  });
});

describe('ensureElementId', () => {
  it('keeps an existing id and assigns a scoped id when missing', () => {
    const ids = createIdScope({ prefix: 'el' });
    const withId = document.createElement('div');
    withId.id = 'given';
    expect(ensureElementId(withId, ids)).toBe('given');
    expect(ids.count).toBe(0);

    const bare = document.createElement('span');
    expect(ensureElementId(bare, ids, 'slot')).toBe('el-0-slot');
    expect(bare.getAttribute('id')).toBe('el-0-slot');
  });

  it('treats whitespace-only id attributes as missing', () => {
    const ids = createIdScope({ prefix: 'el' });
    const el = document.createElement('div');
    el.setAttribute('id', '   ');
    expect(ensureElementId(el, ids)).toBe('el-0');
  });
});

describe('no module-scope randomness', () => {
  it('two fresh default scopes produce the same first ids', () => {
    // Proves there is no shared Math.random or process-wide counter.
    expect(createIdScope().next()).toBe(createIdScope().next());
  });
});
