/**
 * The voice and rules model (kit API §5.5): identity, voice.tone / lexicon /
 * guidelines, accessibility targets, and a locked-mode rules summary from
 * `allow` and `approval`. Pure and total: a malformed document gives empty
 * fields, never a throw. Every string is clipped by `KIT_LIMITS`.
 */
import { KIT_LIMITS, kitText } from '../shared/limits.ts';

export interface VoiceText {
  readonly text: string;
  readonly clipped: boolean;
}

export interface VoiceLexiconRow {
  readonly term: string;
  readonly preferred: string;
  readonly clipped: boolean;
  /** Item-id fragment for a deep link (`kitItemId(..., 'voice', id)`). */
  readonly id: string;
}

export interface VoiceRules {
  /** True when the document has an `allow` object (locked). */
  readonly locked: boolean;
  readonly allowedCount: number;
  readonly approvalStatus: string | undefined;
}

export interface VoiceAccessibility {
  readonly contrast: string | undefined;
  readonly targetMin: string | undefined;
  readonly focus: string | undefined;
}

export interface VoiceModel {
  readonly name: VoiceText | undefined;
  readonly description: VoiceText | undefined;
  readonly owner: VoiceText | undefined;
  readonly license: VoiceText | undefined;
  readonly tags: readonly VoiceText[];
  readonly tone: readonly VoiceText[];
  readonly lexicon: readonly VoiceLexiconRow[];
  readonly guidelines: readonly VoiceText[];
  readonly accessibility: VoiceAccessibility | undefined;
  readonly rules: VoiceRules;
  readonly tagsClipped: number;
  readonly toneClipped: number;
  readonly lexiconClipped: number;
  readonly guidelinesClipped: number;
}

const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clip = (value: unknown): VoiceText | undefined => kitText(value);

function listOf(value: unknown, cap: number): { items: VoiceText[]; clipped: number } {
  if (!Array.isArray(value)) return { items: [], clipped: 0 };
  const items: VoiceText[] = [];
  for (let i = 0; i < value.length && items.length < cap; i++) {
    const text = clip(value[i]);
    if (text) items.push(text);
  }
  return { items, clipped: Math.max(0, value.length - items.length) };
}

/**
 * Read the document's voice, identity, accessibility and lock summary.
 * Never throws.
 */
export function voiceModel(document: unknown): VoiceModel {
  const doc = isRecord(document) ? document : {};
  const voice = isRecord(doc.voice) ? doc.voice : {};
  const tags = listOf(doc.tags, KIT_LIMITS.listItems);
  const tone = listOf(voice.tone, KIT_LIMITS.listItems);
  const guidelines = listOf(voice.guidelines, KIT_LIMITS.listItems);

  const lexicon: VoiceLexiconRow[] = [];
  let lexiconClipped = 0;
  if (isRecord(voice.lexicon)) {
    const keys = Object.keys(voice.lexicon)
      .filter((key) => !RESERVED.has(key))
      .sort();
    for (const key of keys) {
      if (lexicon.length >= KIT_LIMITS.lexiconRows) {
        lexiconClipped += 1;
        continue;
      }
      const term = clip(key);
      const preferred = clip(voice.lexicon[key]);
      if (!term || !preferred) continue;
      lexicon.push({
        term: term.text,
        preferred: preferred.text,
        clipped: term.clipped || preferred.clipped,
        id: `lexicon-${key}`,
      });
    }
  }

  const a11y = isRecord(doc.accessibility) ? doc.accessibility : undefined;
  const accessibility =
    a11y &&
    (a11y.contrast !== undefined || a11y.targetMin !== undefined || a11y.focus !== undefined)
      ? {
          contrast: clip(a11y.contrast)?.text,
          targetMin:
            typeof a11y.targetMin === 'number' && Number.isFinite(a11y.targetMin)
              ? String(a11y.targetMin)
              : clip(a11y.targetMin)?.text,
          focus: clip(a11y.focus)?.text,
        }
      : undefined;

  const allow = isRecord(doc.allow) ? doc.allow : undefined;
  const allowedCount = allow ? Object.keys(allow).filter((key) => !RESERVED.has(key)).length : 0;
  const approval = isRecord(doc.approval) ? doc.approval : undefined;
  const approvalStatus = clip(approval?.status)?.text;

  return {
    name: clip(doc.name),
    description: clip(doc.description),
    owner: clip(doc.owner),
    license: clip(doc.license),
    tags: tags.items,
    tone: tone.items,
    lexicon,
    guidelines: guidelines.items,
    accessibility,
    rules: {
      locked: allow !== undefined,
      allowedCount,
      approvalStatus,
    },
    tagsClipped: tags.clipped,
    toneClipped: tone.clipped,
    lexiconClipped,
    guidelinesClipped: guidelines.clipped,
  };
}

/** Navigable items of the voice section, in page order. */
export function voiceItems(model: VoiceModel): { id: string; label: string }[] {
  const items: { id: string; label: string }[] = [{ id: 'identity', label: 'Identity' }];
  if (model.tone.length > 0) items.push({ id: 'tone', label: 'Tone' });
  if (model.lexicon.length > 0) items.push({ id: 'lexicon', label: 'Lexicon' });
  if (model.guidelines.length > 0) items.push({ id: 'guidelines', label: 'Guidelines' });
  if (model.accessibility) items.push({ id: 'accessibility', label: 'Accessibility' });
  items.push({ id: 'rules', label: 'Locked-mode rules' });
  return items;
}
