/// <reference types="node" />
/**
 * `texuli/ds-kit` voice and rules (T-t4-voice, ADR-032, kit API §5.5 and §11.1):
 * identity, tone, lexicon and guidelines as text; hostile strings stay text
 * and are clipped; locked-mode rules summary; stable deep-link ids.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { KIT_LIMITS, kitItemId, kitSectionId } from '../src/ds-kit/index.ts';
import KitVoice from '../src/ds-kit/voice/KitVoice.svelte';
import { voiceItems, voiceModel } from '../src/ds-kit/voice/model.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const json = <T>(path: string): T => JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as T;
const acme = json<Record<string, unknown>>('packages/spec/fixtures/design-systems/acme.json');
const minimal = json<Record<string, unknown>>('packages/spec/fixtures/design-systems/minimal.json');

afterEach(() => cleanup());

describe('voiceModel', () => {
  it('reads identity, tone, lexicon, guidelines and accessibility from acme', () => {
    const model = voiceModel(acme);
    expect(model.name?.text).toBe('Acme');
    expect(model.description?.text).toMatch(/Acme/);
    expect(model.owner?.text).toBe('Acme Design');
    expect(model.license?.text).toBe('MIT');
    expect(model.tags.map((t) => t.text)).toEqual(['fintech', 'example']);
    expect(model.tone.map((t) => t.text)).toEqual(['clear', 'warm']);
    expect(model.lexicon).toEqual([
      expect.objectContaining({ term: 'board', preferred: 'canvas' }),
      expect.objectContaining({ term: 'workspace', preferred: 'team space' }),
    ]);
    expect(model.guidelines.map((g) => g.text)).toEqual([
      'Write in the second person.',
      'Prefer short sentences.',
    ]);
    expect(model.accessibility).toEqual({
      contrast: 'AA',
      targetMin: '24',
      focus: 'ring',
    });
    expect(model.rules).toEqual({ locked: true, allowedCount: 2, approvalStatus: undefined });
    expect(voiceItems(model).map((i) => i.id)).toEqual([
      'identity',
      'tone',
      'lexicon',
      'guidelines',
      'accessibility',
      'rules',
    ]);
  });

  it('treats a document without allow as unlocked and never throws', () => {
    expect(voiceModel(minimal).rules).toEqual({
      locked: false,
      allowedCount: 0,
      approvalStatus: undefined,
    });
    expect(voiceModel(null).rules.locked).toBe(false);
    expect(voiceModel(undefined).name).toBeUndefined();
    expect(voiceModel({ voice: '<script>' }).tone).toEqual([]);
  });

  it('clips long values and long lists', () => {
    const long = 'x'.repeat(KIT_LIMITS.textChars + 50);
    const model = voiceModel({
      name: long,
      voice: {
        tone: Array.from({ length: KIT_LIMITS.listItems + 5 }, (_, i) => `t${i}`),
        guidelines: [long],
        lexicon: Object.fromEntries(
          Array.from({ length: KIT_LIMITS.lexiconRows + 3 }, (_, i) => [`k${i}`, `v${i}`])
        ),
      },
    });
    expect(model.name?.clipped).toBe(true);
    expect(model.name?.text).toHaveLength(KIT_LIMITS.textChars);
    expect(model.tone).toHaveLength(KIT_LIMITS.listItems);
    expect(model.toneClipped).toBe(5);
    expect(model.guidelines[0]?.clipped).toBe(true);
    expect(model.lexicon).toHaveLength(KIT_LIMITS.lexiconRows);
    expect(model.lexiconClipped).toBe(3);
  });
});

describe('KitVoice', () => {
  it('renders tone, lexicon and guidelines as text', () => {
    render(KitVoice, { props: { document: acme } });
    expect(screen.getByRole('region', { name: 'Voice and rules' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Voice and rules' })).toBeTruthy();
    expect(screen.getByText('clear')).toBeTruthy();
    expect(screen.getByText('warm')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Term' })).toBeTruthy();
    expect(screen.getByText('workspace')).toBeTruthy();
    expect(screen.getByText('team space')).toBeTruthy();
    expect(screen.getByText('Write in the second person.')).toBeTruthy();
    expect(screen.getByText('Prefer short sentences.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Locked-mode rules' })).toBeTruthy();
    expect(screen.getByText(/2 components allowed/)).toBeTruthy();
    expect(screen.getByText(/layout utilities only/)).toBeTruthy();
  });

  it('keeps hostile strings as text, clips them, and stamps stable ids', () => {
    const hostile = {
      name: 'Harborline',
      voice: {
        tone: ['<script>alert(1)</script>'],
        guidelines: [`\u202Eevil${'y'.repeat(KIT_LIMITS.textChars)}`],
        lexicon: { '<img>': 'ok' },
      },
    };
    const { container } = render(KitVoice, { props: { document: hostile, idPrefix: 'kit' } });
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
    expect(container.textContent).toContain('\u202Eevil');
    expect(container.textContent).toContain('(shortened)');
    expect(container.querySelector(`#${kitSectionId('kit', 'voice')}`)).not.toBeNull();
    expect(container.querySelector(`#${kitItemId('kit', 'voice', 'tone')}`)).not.toBeNull();
    expect(container.querySelector(`#${kitItemId('kit', 'voice', 'rules')}`)).not.toBeNull();
  });

  it('summarises unlocked documents without an allow section', () => {
    render(KitVoice, { props: { document: minimal } });
    expect(screen.getByText('Unlocked')).toBeTruthy();
    expect(screen.queryByText(/components allowed/)).toBeNull();
  });
});
