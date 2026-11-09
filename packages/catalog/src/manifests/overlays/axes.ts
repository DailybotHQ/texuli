import { manifestData } from '../../manifest/data.ts';
import type { CatalogAxisName, CatalogManifest, CatalogStateName } from '../../manifest/types.ts';

type AxisStamp = {
  readonly axes?: Readonly<Partial<Record<CatalogAxisName, string>>>;
  readonly states?: readonly CatalogStateName[];
};

/**
 * Part A axes and states for the overlays group (ADR-032). Axes name the enum
 * prop only. States are confirmed against the overlay's CSS/ARIA; generic
 * hover on inner chrome (toaster close, card scan on hover-card) is dropped.
 */
export const OVERLAYS_AXIS_STAMP: Readonly<Record<string, AxisStamp>> = {
  'alert-dialog': { states: ['focus-visible', 'open'] },
  'app-nav': {
    axes: { variant: 'variant' },
    states: ['focus-visible', 'expanded', 'open'],
  },
  breadcrumb: {
    axes: { size: 'size' },
    states: ['hover', 'focus-visible', 'selected'],
  },
  'command-palette': {
    axes: { variant: 'variant', size: 'size' },
    states: ['focus-visible', 'disabled', 'selected', 'open'],
  },
  'context-menu': {
    states: ['hover', 'focus-visible', 'disabled', 'selected', 'checked', 'open'],
  },
  'context-menu-trigger': { states: ['disabled', 'open'] },
  'detail-panel': { axes: { size: 'size' }, states: ['hover', 'focus-visible'] },
  dialog: { axes: { size: 'size' }, states: ['hover', 'focus-visible', 'open'] },
  drawer: { axes: { size: 'size' }, states: ['hover', 'focus-visible'] },
  'dropdown-menu': {
    states: ['hover', 'focus-visible', 'disabled', 'selected', 'checked', 'open'],
  },
  'dropdown-menu-content': {
    axes: { variant: 'variant', size: 'size' },
    states: ['focus-visible'],
  },
  'dropdown-menu-item': { states: ['disabled', 'selected'] },
  'dropdown-menu-trigger': { axes: { variant: 'variant', size: 'size' } },
  'hover-card': { states: ['open'] },
  'hover-card-content': { axes: { variant: 'variant', size: 'size' } },
  menubar: {
    states: ['hover', 'focus-visible', 'disabled', 'selected', 'checked', 'open'],
  },
  'menubar-trigger': {
    axes: { variant: 'variant', size: 'size' },
    states: ['disabled'],
  },
  'navigation-menu': {
    states: ['hover', 'focus-visible', 'disabled', 'selected', 'open'],
  },
  pagination: {
    axes: { variant: 'variant', size: 'size' },
    states: ['hover', 'focus-visible', 'disabled', 'selected'],
  },
  popover: { states: ['open'] },
  'popover-content': { axes: { variant: 'variant', size: 'size' } },
  'responsive-modal': { axes: { size: 'size' }, states: ['hover', 'focus-visible'] },
  sheet: { axes: { size: 'size' }, states: ['hover', 'focus-visible'] },
  sidebar: {
    axes: { variant: 'variant' },
    states: ['hover', 'focus-visible', 'disabled', 'selected', 'expanded'],
  },
  toaster: { states: ['hover', 'focus-visible'] },
  tooltip: { states: ['disabled', 'open'] },
};

/** Applies the part-A stamp. Components with neither axes nor states stay unchanged. */
export function stampOverlaysAxes(manifest: CatalogManifest): CatalogManifest {
  const extra = OVERLAYS_AXIS_STAMP[manifest.id];
  return extra ? manifestData({ ...manifest, ...extra }) : manifest;
}
