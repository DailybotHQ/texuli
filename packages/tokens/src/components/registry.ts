/**
 * The component token tier of token contract v2 (ADR-020): the closed
 * vocabulary a design system may set per component (`components.button.radius`),
 * each with its default reference to a system or theme token. No stylesheet
 * declares component tokens: the default is the fallback every read carries
 * (`componentVar('button', 'radius')`), so a component token exists on a page
 * only when a theme, design system or host sets it on its scope. Defaults equal
 * what each component renders today under the visual-baseline theme; component
 * CSS adopts them in a later task.
 */

/** One component token. */
export interface ComponentToken {
  /** The component id (`button`, `tabs`, `pin-input`). */
  readonly component: string;
  /** The design-system key, unique within the component (`radius`, `height-md`). */
  readonly key: string;
  /** The CSS custom property: `--tx-<component>-<key>`. */
  readonly token: string;
  /** The default (the read fallback): system or theme token references, never a literal color. */
  readonly default: string;
  readonly description: string;
}

/** One component and the `texuli` subpath that styles it. */
export interface ComponentTokenFamily {
  readonly component: string;
  /** The `texuli/<subpath>` export the component ships in. */
  readonly subpath: string;
  readonly title: string;
  readonly tokens: readonly ComponentToken[];
}

type Row = readonly [key: string, value: string, description: string];

const v = (name: string) => `var(--tx-${name})`;
const space = (step: number) => v(`space-${step}`);
const spaceTimes = (factor: number) => `calc(var(--tx-space-unit) * ${factor})`;
const control = (size: string) => v(`size-control-${size}`);
const icon = (size: string) => v(`size-icon-${size}`);
const radius = (size: string) => v(`shape-radius-${size}`);
const elevation = (step: number) => v(`elevation-${step}`);
const type = (role: string, property: string) => v(`type-${role}-${property}`);
const THIN = v('border-width-thin');
const THICK = v('border-width-thick');
const DISABLED = v('opacity-disabled');
const MUTED = v('opacity-muted');

const heights = (prefix = 'height'): Row[] => [
  [`${prefix}-sm`, control('sm'), 'Small size height.'],
  [`${prefix}-md`, control('md'), 'Default size height.'],
  [`${prefix}-lg`, control('lg'), 'Large size height.'],
];

const sizedFonts = (): Row[] => [
  ['font-size-sm', type('caption', 'size'), 'Small size font size.'],
  ['font-size-md', type('label', 'size'), 'Default size font size.'],
  ['font-size-lg', type('body', 'size'), 'Large size font size.'],
];

function family(
  component: string,
  subpath: string,
  title: string,
  rows: readonly Row[]
): ComponentTokenFamily {
  return {
    component,
    subpath,
    title,
    tokens: rows.map(([key, value, description]) => ({
      component,
      key,
      token: `--tx-${component}-${key}`,
      default: value,
      description,
    })),
  };
}

/** Every styled component family and its tokens, in documentation order. */
export const COMPONENT_TOKEN_FAMILIES: readonly ComponentTokenFamily[] = [
  family('alert', 'alert', 'Alert', [
    ['radius', radius('lg'), 'Corner radius.'],
    ['border-width', THIN, 'Border width.'],
    ['padding-block', space(3), 'Block padding.'],
    ['padding-inline', spaceTimes(3.5), 'Inline padding.'],
    ['gap', space(2), 'Gap between icon and content.'],
    ['font-size', type('label', 'size'), 'Body font size.'],
    ['icon-size', icon('md'), 'Status icon size.'],
  ]),
  family('avatar', 'avatar', 'Avatar', [
    ['size-xs', icon('md'), 'Extra small avatar size.'],
    ['size-sm', control('xs'), 'Small avatar size.'],
    ['size-md', control('md'), 'Default avatar size.'],
    ['size-lg', space(12), 'Large avatar size.'],
    ['radius', radius('full'), 'Corner radius.'],
    ['font-weight', type('heading', 'weight'), 'Initials font weight.'],
  ]),
  family('badge', 'badge', 'Badge, tag and chip', [
    ['radius', radius('full'), 'Corner radius.'],
    ['padding-block', spaceTimes(0.5), 'Block padding.'],
    ['padding-inline', space(2), 'Inline padding.'],
    ['gap', space(1), 'Gap between icon and text.'],
    ['font-size', type('caption', 'size'), 'Font size.'],
    ['font-weight', type('label', 'weight'), 'Font weight.'],
    ['line-height', type('label', 'line'), 'Line height.'],
    ['border-width', THIN, 'Border width.'],
  ]),
  family('button', 'button', 'Button', [
    ...heights(),
    ['height-touch', v('size-target-touch'), 'Height of sm, md and icon buttons below 640 px.'],
    ['padding-inline-sm', space(3), 'Small size inline padding.'],
    ['padding-inline-md', space(4), 'Default size inline padding.'],
    ['padding-inline-lg', space(6), 'Large size inline padding.'],
    ['gap', space(2), 'Gap between icon and label.'],
    ['radius', radius('lg'), 'Corner radius.'],
    ['font-size', type('label', 'size'), 'Default size font size.'],
    ['font-size-sm', type('caption', 'size'), 'Small size font size.'],
    ['font-size-lg', type('body', 'size'), 'Large size font size.'],
    ['font-weight', type('label', 'weight'), 'Font weight.'],
    ['line-height', type('label', 'line'), 'Line height.'],
    ['icon-size', icon('sm'), 'Icon size inside the button.'],
    ['border-width', THIN, 'Outline variant border width.'],
    ['elevation', elevation(1), 'Shadow of the default, outline and destructive variants.'],
    ['disabled-opacity', DISABLED, 'Opacity when disabled.'],
  ]),
  family('card', 'card', 'Card', [
    ['radius', radius('xl'), 'Corner radius.'],
    ['border-width', THIN, 'Border width.'],
    ['elevation', elevation(1), 'Shadow.'],
    ['padding-inline', space(5), 'Header, content and footer inline padding.'],
    [
      'padding-block',
      space(5),
      'Block padding at the card edges (header top, last section bottom).',
    ],
    ['background', v('surface'), 'Surface fill (the glass hook mixes it with transparency).'],
    ['title-font-size', v('font-size-base'), 'Title font size.'],
    ['title-font-weight', type('heading', 'weight'), 'Title font weight.'],
    ['title-line-height', type('label', 'line'), 'Title line height.'],
    ['description-font-size', type('label', 'size'), 'Description font size.'],
  ]),
  family('carousel', 'carousel', 'Carousel', [
    ['radius', radius('lg'), 'Corner radius of the carousel and viewport.'],
    ['fallback-padding', space(4), 'Padding of the no-slides fallback.'],
  ]),
  family('choice', 'choice', 'Checkbox, radio and switch', [
    ['gap', spaceTimes(2.5), 'Gap between control and copy.'],
    ['switch-gap', space(4), 'Gap between switch and copy.'],
    ['label-font-size', type('label', 'size'), 'Label font size.'],
    ['label-font-weight', type('label', 'weight'), 'Label font weight.'],
    ['description-font-size', type('caption', 'size'), 'Description font size.'],
    ['disabled-opacity', DISABLED, 'Opacity of a disabled control.'],
  ]),
  family('combobox', 'combobox', 'Combobox', [
    ...heights(),
    ['radius', radius('lg'), 'Field corner radius.'],
    ['border-width', THIN, 'Field border width.'],
    ...sizedFonts(),
  ]),
  family('command', 'command', 'Command palette', [
    ['radius', radius('xl'), 'Corner radius.'],
    ['border-width', THIN, 'Border width.'],
    ...sizedFonts(),
    ['input-gap', space(3), 'Gap inside the input row.'],
    ['input-padding-inline', space(4), 'Inline padding of the input row.'],
  ]),
  family('date', 'date', 'Date field and picker', [
    ['font-size', type('label', 'size'), 'Font size.'],
    ['label-font-weight', type('label', 'weight'), 'Label font weight.'],
    ['control-radius', radius('lg'), 'Control corner radius.'],
    ['control-border-width', THIN, 'Control border width.'],
    ['panel-z-index', v('z-popover'), 'Calendar panel stacking.'],
    ['panel-padding', space(3), 'Calendar panel padding.'],
    ['panel-radius', radius('xl'), 'Calendar panel corner radius.'],
    ['panel-elevation', elevation(3), 'Calendar panel shadow.'],
    ['description-font-size', type('caption', 'size'), 'Description and error font size.'],
  ]),
  family('dialog', 'dialog', 'Dialog and alert dialog', [
    ['z-index', v('z-modal'), 'Stacking.'],
    ['radius', radius('xl'), 'Corner radius.'],
    ['border-width', THIN, 'Border width.'],
    ['elevation', elevation(4), 'Shadow.'],
    ['font-size', v('font-size-sm'), 'Body font size.'],
    ['line-height', type('body', 'line'), 'Body line height.'],
    ['title-font-size', type('heading', 'size'), 'Title font size.'],
    ['title-font-weight', type('heading', 'weight'), 'Title font weight.'],
    ['title-line-height', type('heading', 'line'), 'Title line height.'],
    ['alert-padding', space(5), 'Alert dialog padding.'],
    ['scrim-opacity', v('opacity-scrim'), 'Foreground mix of the overlay scrim.'],
  ]),
  family('empty', 'empty', 'Empty state', [
    ['gap', space(3), 'Default size gap.'],
    ['padding-inline', space(6), 'Default size inline padding.'],
    ['padding-block', spaceTimes(14), 'Default size block padding.'],
    ['title-font-size', v('font-size-base'), 'Title font size.'],
    ['title-font-weight', type('heading', 'weight'), 'Title font weight.'],
    ['description-font-size', type('label', 'size'), 'Description font size.'],
  ]),
  family('field', 'field', 'Field label and description', [
    ['gap', spaceTimes(1.5), 'Gap between label, control and description.'],
    ['label-font-size', type('label', 'size'), 'Label font size.'],
    ['label-font-weight', type('label', 'weight'), 'Label font weight.'],
    ['label-line-height', type('label', 'line'), 'Label line height.'],
    ['description-font-size', type('caption', 'size'), 'Description font size.'],
    ['description-line-height', type('caption', 'line'), 'Description line height.'],
  ]),
  family('file-upload', 'file-upload', 'File upload', [
    ['gap', space(3), 'Gap between the zone and the list.'],
    ['zone-padding-block', space(6), 'Drop zone block padding.'],
    ['zone-padding-inline', space(4), 'Drop zone inline padding.'],
    ['zone-border-width', THICK, 'Drop zone dashed border width.'],
    ['zone-radius', radius('lg'), 'Drop zone corner radius.'],
    ['browse-height', control('md'), 'Browse button height.'],
  ]),
  family('icon', 'icons', 'Icon', [
    ['size-xs', icon('xs'), 'Size xs.'],
    ['size-sm', icon('sm'), 'Size sm.'],
    ['size-md', icon('md'), 'Size md (the default).'],
    ['size-lg', icon('lg'), 'Size lg.'],
    ['stroke-width', v('icon-stroke'), 'Stroke width.'],
  ]),
  family('input', 'input', 'Input and textarea', [
    ['height', control('md'), 'Input height from 640 px.'],
    ['height-touch', control('lg'), 'Input minimum height below 640 px.'],
    ['padding-block', space(1), 'Input block padding.'],
    ['padding-inline', space(3), 'Inline padding.'],
    ['radius', radius('lg'), 'Corner radius.'],
    ['border-width', THIN, 'Border width.'],
    ['elevation', elevation(1), 'Shadow.'],
    ['font-size', v('font-size-sm'), 'Font size from 640 px.'],
    ['font-size-touch', v('font-size-base'), 'Font size below 640 px (avoids zoom on focus).'],
    ['font-weight', type('body', 'weight'), 'Font weight.'],
    ['textarea-padding-block', space(2), 'Textarea block padding.'],
    ['disabled-opacity', DISABLED, 'Opacity when disabled.'],
  ]),
  family('kbd', 'kbd-code', 'Keyboard key', [
    ['min-size', icon('md'), 'Minimum inline and block size.'],
    ['padding-block', spaceTimes(0.5), 'Block padding.'],
    ['radius', `calc(${radius('lg')} * 0.4)`, 'Corner radius.'],
    ['border-width', THIN, 'Border width.'],
    ['font-weight', type('label', 'weight'), 'Font weight.'],
  ]),
  family('code', 'kbd-code', 'Code', [
    ['font-size', type('code', 'size'), 'Font size relative to the surrounding text.'],
    ['font-weight', type('code', 'weight'), 'Font weight.'],
    ['block-padding-block', space(3), 'Code block block padding.'],
    ['block-padding-inline', space(4), 'Code block inline padding.'],
    ['block-radius', radius('lg'), 'Code block corner radius.'],
    ['block-line-height', type('code', 'line'), 'Code block line height.'],
    ['block-border-width', THIN, 'Code block border width.'],
  ]),
  family('menu', 'menus', 'Menus', [
    ...heights('trigger-height'),
    ['trigger-radius', radius('lg'), 'Trigger corner radius.'],
    ['trigger-border-width', THIN, 'Trigger border width.'],
    ['trigger-font-size', type('label', 'size'), 'Trigger font size.'],
    ['trigger-font-weight', type('label', 'weight'), 'Trigger font weight.'],
    ['content-z-index', v('z-popover'), 'Menu stacking.'],
    ['content-padding-block', space(1), 'Menu block padding.'],
    ['content-radius', radius('lg'), 'Menu corner radius.'],
    ['content-elevation', elevation(3), 'Menu shadow.'],
    ['content-font-size', type('label', 'size'), 'Menu font size.'],
  ]),
  family('navigation', 'navigation', 'Navigation menu', [
    ['z-index', v('z-sticky'), 'Stacking.'],
    ['font-size', type('label', 'size'), 'Default size font size.'],
    ['list-gap', space(1), 'Gap between items.'],
    ['trigger-radius', radius('md'), 'Trigger and link corner radius.'],
    ['chevron-opacity', MUTED, 'Trigger chevron opacity.'],
  ]),
  family('number-field', 'number-pin', 'Number field', [
    ['radius', radius('lg'), 'Corner radius.'],
    ['border-width', THIN, 'Border width.'],
    ['padding-block', space(2), 'Input block padding.'],
    ['padding-inline', space(3), 'Input inline padding.'],
    ['stepper-size', control('md'), 'Stepper button minimum inline size.'],
  ]),
  family('pin-input', 'number-pin', 'PIN input', [
    ['gap', space(2), 'Gap between cells.'],
    ['cell-inline-size', control('lg'), 'Cell inline size.'],
    ['cell-block-size', space(12), 'Cell block size.'],
    ['cell-radius', radius('lg'), 'Cell corner radius.'],
    ['cell-font-size', type('heading', 'size'), 'Cell font size.'],
  ]),
  family('popover', 'popover', 'Popover and hover card', [
    ['z-index', v('z-popover'), 'Stacking.'],
    ['padding-block', space(3), 'Default size block padding.'],
    ['padding-inline', spaceTimes(3.5), 'Default size inline padding.'],
    ['radius', radius('lg'), 'Corner radius.'],
    ['border-width', THIN, 'Border width.'],
    ['elevation', elevation(3), 'Shadow.'],
    ['font-size', type('label', 'size'), 'Font size.'],
    ['title-font-size', v('font-size-base'), 'Title font size.'],
    ['title-font-weight', type('heading', 'weight'), 'Title font weight.'],
    ['title-line-height', type('heading', 'line'), 'Title line height.'],
  ]),
  family('progress', 'feedback', 'Progress', [
    ['gap', spaceTimes(1.5), 'Gap between header and track.'],
    ['font-size', type('label', 'size'), 'Header font size.'],
    ['radius', radius('full'), 'Track corner radius.'],
    ['track-height-sm', spaceTimes(1.5), 'Small track height.'],
    ['track-height-md', spaceTimes(2.5), 'Default track height.'],
    ['track-height-lg', spaceTimes(3.5), 'Large track height.'],
  ]),
  family('rating', 'rating', 'Rating', [
    ['stars-gap', spaceTimes(0.5), 'Gap between stars.'],
    ['label-font-size', type('label', 'size'), 'Label font size.'],
    ['label-font-weight', type('label', 'weight'), 'Label font weight.'],
    ['star-radius', radius('lg'), 'Star focus box corner radius.'],
  ]),
  family('resizable', 'resizable', 'Resizable panels', [
    ['radius', radius('xl'), 'Bordered group corner radius.'],
    ['border-width', THIN, 'Bordered group border width.'],
  ]),
  family('scroll-area', 'scroll-area', 'Scroll area', [
    ['radius', radius('lg'), 'Corner radius.'],
    ['border-width', THIN, 'Border width.'],
    ['padding', space(3), 'Viewport padding.'],
    ['scrollbar-size', spaceTimes(2.5), 'Scrollbar thickness.'],
    ['scrollbar-radius', radius('full'), 'Scrollbar corner radius.'],
    ['thumb-min-size', space(4), 'Minimum thumb length.'],
  ]),
  family('select', 'select', 'Select', [
    ...heights(),
    ['padding-inline-sm', space(2), 'Small size inline padding.'],
    ['padding-inline-md', space(3), 'Default size inline padding.'],
    ['padding-inline-lg', spaceTimes(3.5), 'Large size inline padding.'],
    ['gap', space(2), 'Gap between value and chevron.'],
    ['radius', radius('lg'), 'Trigger corner radius.'],
    ['border-width', THIN, 'Trigger border width.'],
    ...sizedFonts(),
    ['font-weight', type('body', 'weight'), 'Trigger font weight.'],
    ['chevron-size', icon('sm'), 'Chevron size.'],
    ['chevron-opacity', MUTED, 'Chevron opacity.'],
  ]),
  family('separator', 'separator-aspect', 'Separator', [['thickness', THIN, 'Line thickness.']]),
  family('aspect-ratio', 'separator-aspect', 'Aspect ratio', [
    ['radius', radius('lg'), 'Corner radius.'],
  ]),
  family('sheet', 'sheet', 'Sheet, drawer and detail panel', [
    ['z-index', v('z-overlay'), 'Stacking.'],
    ['gap', space(4), 'Gap between header, body and footer.'],
    ['padding', space(5), 'Padding.'],
    ['border-width', THIN, 'Border width.'],
    ['elevation', elevation(4), 'Shadow.'],
    ['font-size', v('font-size-sm'), 'Body font size.'],
    ['line-height', type('body', 'line'), 'Body line height.'],
    ['title-font-size', type('heading', 'size'), 'Title font size.'],
    ['title-font-weight', type('heading', 'weight'), 'Title font weight.'],
    ['title-line-height', type('heading', 'line'), 'Title line height.'],
    ['scrim-opacity', v('opacity-scrim'), 'Foreground mix of the overlay scrim.'],
  ]),
  family('sidebar', 'sidebar', 'Sidebar', [
    ['font-size', v('font-size-sm'), 'Font size.'],
    ['inset-radius', radius('lg'), 'Inset variant corner radius.'],
    ['header-padding-inline', space(3), 'Header inline padding.'],
    ['header-gap', space(2), 'Header gap.'],
    ['body-gap', space(4), 'Gap between sections.'],
    ['body-padding-block', space(3), 'Body block padding.'],
    ['body-padding-inline', space(2), 'Body inline padding.'],
  ]),
  family('skeleton', 'feedback', 'Skeleton', [
    ['radius', radius('md'), 'Corner radius.'],
    ['height-sm', space(3), 'Small line height.'],
    ['height-md', space(4), 'Default line height.'],
    ['height-lg', space(6), 'Large line height.'],
    ['circle-size', space(10), 'Circle size.'],
  ]),
  family('slider', 'slider', 'Slider', [
    ['thumb-border-width', THICK, 'Thumb border width.'],
    ['thumb-elevation', elevation(2), 'Thumb shadow.'],
    ['disabled-opacity', DISABLED, 'Opacity when disabled.'],
  ]),
  family('spinner', 'feedback', 'Spinner', [['radius', radius('full'), 'Corner radius.']]),
  family('stat', 'stat', 'Stat and KPI', [
    ['gap', space(2), 'Gap between rows.'],
    ['padding', space(5), 'Padding.'],
    ['radius', radius('xl'), 'Corner radius.'],
    ['border-width', THIN, 'Border width.'],
    ['elevation', elevation(1), 'Shadow.'],
    ['label-font-size', type('label', 'size'), 'Label font size.'],
    ['label-font-weight', type('label', 'weight'), 'Label font weight.'],
    ['value-font-size', type('title', 'size'), 'Value font size.'],
    ['value-font-weight', type('heading', 'weight'), 'Value font weight.'],
    ['icon-size', control('sm'), 'Icon box size.'],
    ['icon-radius', radius('md'), 'Icon box corner radius.'],
  ]),
  family('stepper', 'stepper', 'Stepper', [
    ['gap', space(3), 'Gap between marker and body.'],
    ['trigger-radius', radius('md'), 'Trigger corner radius.'],
    ['marker-size', control('sm'), 'Marker size.'],
    ['marker-radius', radius('full'), 'Marker corner radius.'],
    ['marker-border-width', THIN, 'Marker border width.'],
    ['marker-font-size', type('caption', 'size'), 'Marker font size.'],
    ['marker-font-weight', type('heading', 'weight'), 'Marker font weight.'],
    ['check-size', icon('sm'), 'Completed check icon size.'],
  ]),
  family('table', 'table', 'Table', [
    ['radius', radius('xl'), 'Wrapper corner radius.'],
    ['border-width', THIN, 'Wrapper border width.'],
    ['font-size', v('font-size-sm'), 'Font size.'],
    ['head-font-size', type('caption', 'size'), 'Header cell font size.'],
    ['head-font-weight', type('label', 'weight'), 'Header cell font weight.'],
  ]),
  family('tabs', 'tabs-accordion', 'Tabs', [
    ['gap', space(3), 'Gap between list and panel.'],
    ['list-gap', space(1), 'Gap between triggers.'],
    ['list-radius', radius('lg'), 'Pills and enclosed list corner radius.'],
    ['trigger-gap', space(2), 'Gap inside a trigger.'],
    ['trigger-height-touch', control('lg'), 'Trigger minimum height below 640 px.'],
    ['trigger-font-size', type('label', 'size'), 'Trigger font size.'],
    ['trigger-font-weight', type('label', 'weight'), 'Trigger font weight.'],
    ['disabled-opacity', DISABLED, 'Disabled trigger opacity.'],
  ]),
  family('accordion', 'tabs-accordion', 'Accordion and collapsible', [
    ['trigger-gap', space(4), 'Gap inside a trigger.'],
    ['trigger-padding-block', space(3), 'Trigger block padding.'],
    ['trigger-font-size', type('label', 'size'), 'Trigger font size.'],
    ['trigger-font-weight', type('label', 'weight'), 'Trigger font weight.'],
    ['disabled-opacity', DISABLED, 'Disabled trigger opacity.'],
  ]),
  family('tags-input', 'tags-color', 'Tags input', [
    ['height', control('md'), 'Minimum height from 640 px.'],
    ['height-touch', control('lg'), 'Minimum height below 640 px.'],
    ['gap', spaceTimes(1.5), 'Gap between tags.'],
    ['padding-inline', space(2), 'Inline padding.'],
    ['radius', radius('lg'), 'Corner radius.'],
    ['border-width', THIN, 'Border width.'],
    ['elevation', elevation(1), 'Shadow.'],
    ['tag-radius', radius('full'), 'Tag corner radius.'],
    ['tag-font-size', type('label', 'size'), 'Tag font size.'],
    ['disabled-opacity', DISABLED, 'Opacity when disabled.'],
  ]),
  family('color-picker', 'tags-color', 'Color picker', [
    ['gap', space(3), 'Gap between parts.'],
    ['swatch-size', icon('lg'), 'Preset swatch size.'],
    ['swatch-radius', radius('sm'), 'Preset swatch corner radius.'],
  ]),
  family('timeline', 'timeline', 'Timeline', [
    ['marker-size', icon('sm'), 'Marker size.'],
    ['marker-radius', radius('full'), 'Marker corner radius.'],
    ['time-font-size', type('caption', 'size'), 'Time font size.'],
    ['time-font-weight', type('label', 'weight'), 'Time font weight.'],
  ]),
  family('toast', 'toast', 'Toast', [
    ['z-index', v('z-toast'), 'Viewport stacking.'],
    ['gap', space(3), 'Gap between icon, body and actions.'],
    ['padding-block', space(3), 'Block padding.'],
    ['radius', radius('lg'), 'Corner radius.'],
    ['border-width', THIN, 'Border width.'],
    ['elevation', elevation(5), 'Shadow.'],
    ['icon-size', icon('md'), 'Status icon size.'],
    ['title-font-size', type('label', 'size'), 'Title font size.'],
    ['title-font-weight', type('label', 'weight'), 'Title font weight.'],
  ]),
  family('toggle', 'toggle', 'Toggle and toggle group', [
    ...heights(),
    ['padding-inline-sm', space(2), 'Small size inline padding.'],
    ['padding-inline-md', space(3), 'Default size inline padding.'],
    ['padding-inline-lg', space(4), 'Large size inline padding.'],
    ['gap', spaceTimes(1.5), 'Gap between icon and label.'],
    ['radius', radius('lg'), 'Corner radius.'],
    ['border-width', THIN, 'Outline variant border width.'],
    ['font-size', type('label', 'size'), 'Font size.'],
    ['font-weight', type('label', 'weight'), 'Font weight.'],
    ['line-height', type('label', 'line'), 'Line height.'],
    ['disabled-opacity', DISABLED, 'Opacity when disabled.'],
  ]),
  family('toolbar', 'toolbar', 'Toolbar', [
    ['gap', space(1), 'Gap between items.'],
    ['padding', space(1), 'Padding.'],
    ['radius', radius('lg'), 'Corner radius.'],
    ['border-width', THIN, 'Outline variant border width.'],
    ['item-height-sm', control('xs'), 'Small item height.'],
    ['item-font-size', type('label', 'size'), 'Item font size.'],
    ['item-font-weight', type('label', 'weight'), 'Item font weight.'],
    ['disabled-opacity', DISABLED, 'Disabled item opacity.'],
  ]),
  family('tooltip', 'tooltip', 'Tooltip', [
    ['z-index', v('z-tooltip'), 'Stacking.'],
    ['radius', `calc(${radius('lg')} * 0.55)`, 'Corner radius.'],
    ['font-size', type('caption', 'size'), 'Font size.'],
    ['font-weight', type('label', 'weight'), 'Font weight.'],
    ['line-height', type('caption', 'line'), 'Line height.'],
    ['elevation', elevation(3), 'Shadow.'],
  ]),
  family('tree', 'tree', 'Tree', [
    ['gap', spaceTimes(0.5), 'Gap between rows.'],
    ['padding', space(1), 'Padding.'],
    ['radius', radius('lg'), 'Corner radius.'],
    ['row-gap', space(2), 'Gap inside a row.'],
    ['row-padding-block', space(1), 'Row block padding.'],
    ['checkbox-size', icon('sm'), 'Checkbox size.'],
    ['checkbox-radius', radius('xs'), 'Checkbox corner radius.'],
  ]),
];

/** Every component token, flattened in family order. */
export const COMPONENT_TOKENS: readonly ComponentToken[] = COMPONENT_TOKEN_FAMILIES.flatMap(
  (entry) => entry.tokens
);

/** Every component id the registry covers. */
export const COMPONENT_IDS: readonly string[] = COMPONENT_TOKEN_FAMILIES.map(
  (entry) => entry.component
);

/** The tokens of one component, or an empty list for an unknown id. */
export function getComponentTokens(component: string): readonly ComponentToken[] {
  return COMPONENT_TOKEN_FAMILIES.find((entry) => entry.component === component)?.tokens ?? [];
}

/** Look up one token by component and key (`button`, `radius`). */
export function findComponentToken(component: string, key: string): ComponentToken | undefined {
  return getComponentTokens(component).find((entry) => entry.key === key);
}

/** True when `name` is a component token custom property. */
export function isComponentTokenName(name: string): boolean {
  return COMPONENT_TOKENS.some((entry) => entry.token === name);
}
