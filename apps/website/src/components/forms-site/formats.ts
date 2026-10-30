/**
 * Every named format of `@texuli/forms/model` (`FORM_FORMATS`) with one
 * value it accepts and one it refuses, for the format lab on /forms-page/.
 * The record is keyed by `FormFormat`, so a new format fails the type check
 * until it has samples; apps/website/tests/site-forms.test.ts runs each
 * sample through `matchesFormat`. Fictional values only.
 */
import { FORM_FORMATS, type FormFormat } from '@texuli/forms/model';

export interface FormatSample {
  readonly format: FormFormat;
  readonly valid: string;
  readonly invalid: string;
  readonly note: string;
}

const SAMPLES: Readonly<Record<FormFormat, Omit<FormatSample, 'format'>>> = {
  email: { valid: 'ada@example.com', invalid: 'ada@', note: 'One @, no spaces, a dotted domain' },
  url: {
    valid: 'https://example.com/docs',
    invalid: 'javascript:alert(1)',
    note: 'https only, through the untrusted URL policy',
  },
  phone: {
    valid: '+1 555 010 0199',
    invalid: 'call me',
    note: '7 to 15 digits; spaces, dots, hyphens, parentheses and one leading +',
  },
  'postal-code': {
    valid: 'SW1A 1AA',
    invalid: '!!!',
    note: 'Any country: 2 to 10 letters, digits, spaces or hyphens',
  },
  'postal-code-us': { valid: '94107-1234', invalid: '9410', note: 'United States: ZIP or ZIP+4' },
  'postal-code-ca': { valid: 'K1A 0B1', invalid: '12345', note: 'Canada' },
  'postal-code-uk': { valid: 'EC1A 1BB', invalid: '1234', note: 'United Kingdom' },
  'postal-code-de': { valid: '10115', invalid: '1011', note: 'Germany: five digits' },
  'postal-code-fr': { valid: '75008', invalid: '7500A', note: 'France: five digits' },
  'postal-code-es': { valid: '28013', invalid: '2801', note: 'Spain: five digits' },
  'postal-code-mx': { valid: '06600', invalid: '066', note: 'Mexico: five digits' },
  'postal-code-br': {
    valid: '01310-100',
    invalid: '0131',
    note: 'Brazil: CEP, the hyphen optional',
  },
  'postal-code-co': { valid: '110111', invalid: '11011', note: 'Colombia: six digits' },
  'postal-code-in': { valid: '110001', invalid: '11000', note: 'India: six-digit PIN' },
  'postal-code-jp': {
    valid: '100-0001',
    invalid: '1000-01',
    note: 'Japan: three digits, then four, the hyphen optional',
  },
  'postal-code-au': { valid: '2000', invalid: '200', note: 'Australia: four digits' },
  digits: { valid: '004211', invalid: '42a', note: 'Digits only' },
  alphanumeric: { valid: 'Harbor42', invalid: 'Harbor 42', note: 'Letters and digits' },
  slug: {
    valid: 'harbor-notes',
    invalid: 'Harbor Notes',
    note: 'Lowercase words joined by hyphens',
  },
  'iso-date': {
    valid: '2026-11-03',
    invalid: '2026-13-03',
    note: 'A real calendar date, YYYY-MM-DD',
  },
  time: { valid: '09:30', invalid: '25:00', note: '24-hour HH:MM' },
  'hex-color': { valid: '#0ea5e9', invalid: '#0ea5e', note: '#rgb or #rrggbb' },
};

export const FORMAT_SAMPLES: readonly FormatSample[] = FORM_FORMATS.map((format) => ({
  format,
  ...SAMPLES[format],
}));
