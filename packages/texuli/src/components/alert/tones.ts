import { variants } from '../../internal/variants.ts';
// Side-effect: recipe-only imports still get alert/callout/banner chrome.
import './alert.css';

/** Semantic tones for Alert, Callout and Banner. */
export const ALERT_TONES = ['info', 'success', 'warning', 'error', 'brand', 'neutral'] as const;
export type AlertTone = (typeof ALERT_TONES)[number];

/** Layout shapes shared across the three surfaces. */
export const ALERT_LAYOUTS = ['alert', 'callout', 'banner'] as const;
export type AlertLayout = (typeof ALERT_LAYOUTS)[number];

export const alertSurfaceClass = variants({
  base: 'tx-alert',
  variants: {
    layout: {
      alert: 'tx-alert--layout-alert',
      callout: 'tx-alert--layout-callout',
      banner: 'tx-alert--layout-banner',
    },
    tone: {
      info: 'tx-alert--info',
      success: 'tx-alert--success',
      warning: 'tx-alert--warning',
      error: 'tx-alert--error',
      brand: 'tx-alert--brand',
      neutral: 'tx-alert--neutral',
    },
  },
  defaultVariants: {
    layout: 'alert',
    tone: 'info',
  },
});

/** ARIA role: errors interrupt; other tones are polite status. */
export function alertRole(tone: AlertTone): 'alert' | 'status' {
  return tone === 'error' ? 'alert' : 'status';
}
