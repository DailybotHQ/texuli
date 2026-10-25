import type {
  ChartArraySchema,
  ChartComponentPropSchema,
  ChartObjectFieldSchema,
  ChartPropSchema,
  ChartSchemaDefinitions,
  ChartValueSchema,
} from './types.ts';

const nonEmptyString = { kind: 'string', constraints: { nonEmpty: true } } as const;
const stringValue = { kind: 'string' } as const;
const finiteNumber = { kind: 'number', constraints: { finite: true } } as const;
const nonNegativeNumber = {
  kind: 'number',
  constraints: { finite: true, minimum: 0 },
} as const;
const positiveNumber = {
  kind: 'number',
  constraints: { finite: true, exclusiveMinimum: 0 },
} as const;
const nullableNumber = { kind: 'nullable', value: finiteNumber } as const;
const stringOrNumber = {
  kind: 'union',
  variants: [nonEmptyString, finiteNumber],
} as const;

const nested = <const Name extends string, const Required extends boolean = true>(
  name: Name,
  label: string,
  description: string,
  value: ChartValueSchema,
  required: Required = true as Required,
  defaultValue?: ChartObjectFieldSchema['default']
): ChartObjectFieldSchema & { readonly name: Name; readonly required: Required } => ({
  name,
  label,
  description,
  required,
  ...value,
  ...(defaultValue === undefined ? {} : { default: defaultValue }),
});

const prop = <const Name extends string, const Required extends boolean = false>(
  name: Name,
  label: string,
  description: string,
  group: ChartPropSchema['group'],
  value: ChartValueSchema,
  required: Required = false as Required,
  defaultValue?: ChartPropSchema['default'],
  exposure: ChartPropSchema['exposure'] = 'blueprint'
): ChartPropSchema & { readonly name: Name; readonly required: Required } => ({
  name,
  label,
  description,
  group,
  required,
  ...value,
  exposure,
  ...(defaultValue === undefined ? {} : { default: defaultValue }),
});

const object = (
  properties: readonly ChartObjectFieldSchema[],
  additionalProperties: false | ChartValueSchema = false
): ChartValueSchema => ({ kind: 'object', properties, additionalProperties });

const array = (
  items: ChartValueSchema,
  uniqueBy?: string,
  maxItems?: number
): ChartArraySchema => ({
  kind: 'array',
  items,
  ...(uniqueBy === undefined && maxItems === undefined
    ? {}
    : {
        constraints: {
          ...(uniqueBy === undefined ? {} : { uniqueBy }),
          ...(maxItems === undefined ? {} : { maxItems }),
        },
      }),
});

const title = prop(
  'title',
  'Title',
  'Visible chart title and accessible name.',
  'accessibility',
  nonEmptyString,
  true
);
const description = prop(
  'description',
  'Description',
  'Accessible summary of the chart and its main conclusion.',
  'accessibility',
  nonEmptyString,
  true
);
const optionalDescription = prop(
  'description',
  'Description',
  'Optional accessible summary; the component derives one when omitted.',
  'accessibility',
  nonEmptyString
);
const label = prop(
  'label',
  'Label',
  'Visible measure label and accessible name.',
  'accessibility',
  nonEmptyString,
  true
);
const width = (value: number) =>
  prop('width', 'Width', 'View-box width in pixels.', 'layout', positiveNumber, false, value);
const height = (value: number) =>
  prop('height', 'Height', 'View-box height in pixels.', 'layout', positiveNumber, false, value);
const cssClass = prop(
  'class',
  'CSS class',
  'Application-authored class value.',
  'appearance',
  stringValue,
  false,
  '',
  'developer'
);
const optionalCssClass = prop(
  'class',
  'CSS class',
  'Application-authored class value.',
  'appearance',
  stringValue,
  false,
  undefined,
  'developer'
);
const mode = prop(
  'mode',
  'Color mode',
  'Color mode used by the chart frame.',
  'appearance',
  { kind: 'enum', enumValues: ['light', 'dark'] },
  false,
  'light'
);

const chartLabels = (fields: readonly ChartObjectFieldSchema[], defaults: Record<string, string>) =>
  prop(
    'labels',
    'Labels',
    'Localized labels for the accessible data table and chart text.',
    'localization',
    object(fields),
    false,
    defaults
  );

const cartesianPoint = object([
  nested('x', 'X value', 'Category, numeric value, or epoch milliseconds.', stringOrNumber),
  nested('y', 'Y value', 'Finite value; null creates a visible gap.', nullableNumber),
]);
const cartesianSeries = object([
  nested('id', 'ID', 'Stable unique series identifier.', nonEmptyString),
  nested('label', 'Label', 'Visible and accessible series label.', nonEmptyString),
  nested('points', 'Points', 'Ordered points in this series.', array(cartesianPoint)),
  nested(
    'color',
    'Color',
    'Optional CSS color; theme chart tokens are used when omitted.',
    { kind: 'string', constraints: { format: 'css-color' } },
    false
  ),
]);
const annotationColor = {
  kind: 'string',
  constraints: { format: 'css-color' },
} as const;
const annotationLineX = object([
  nested('id', 'ID', 'Stable annotation identifier.', nonEmptyString),
  nested('type', 'Type', 'Reference line annotation.', { kind: 'enum', enumValues: ['line'] }),
  nested('axis', 'Axis', 'Axis that receives the reference value.', {
    kind: 'enum',
    enumValues: ['x'],
  }),
  nested('value', 'Value', 'Axis value where the line is placed.', stringOrNumber),
  nested('label', 'Label', 'Accessible annotation label.', nonEmptyString),
  nested('color', 'Color', 'Optional theme-aware CSS color.', annotationColor, false),
]);
const annotationLineY = object([
  nested('id', 'ID', 'Stable annotation identifier.', nonEmptyString),
  nested('type', 'Type', 'Reference line annotation.', { kind: 'enum', enumValues: ['line'] }),
  nested('axis', 'Axis', 'Axis that receives the reference value.', {
    kind: 'enum',
    enumValues: ['y'],
  }),
  nested('value', 'Value', 'Axis value where the line is placed.', stringOrNumber),
  nested('label', 'Label', 'Accessible annotation label.', nonEmptyString),
  nested('color', 'Color', 'Optional theme-aware CSS color.', annotationColor, false),
]);
const cartesianAnnotationLineY = object([
  nested('id', 'ID', 'Stable annotation identifier.', nonEmptyString),
  nested('type', 'Type', 'Reference line annotation.', { kind: 'enum', enumValues: ['line'] }),
  nested('axis', 'Axis', 'Axis that receives the reference value.', {
    kind: 'enum',
    enumValues: ['y'],
  }),
  nested('value', 'Value', 'Finite numeric value where the line is placed.', finiteNumber),
  nested('label', 'Label', 'Accessible annotation label.', nonEmptyString),
  nested('color', 'Color', 'Optional theme-aware CSS color.', annotationColor, false),
]);
const annotationBandX = object([
  nested('id', 'ID', 'Stable annotation identifier.', nonEmptyString),
  nested('type', 'Type', 'Reference band annotation.', { kind: 'enum', enumValues: ['band'] }),
  nested('axis', 'Axis', 'Axis that receives the band range.', { kind: 'enum', enumValues: ['x'] }),
  nested('start', 'Start', 'First axis value in the band.', stringOrNumber),
  nested('end', 'End', 'Second axis value in the band.', stringOrNumber),
  nested('label', 'Label', 'Accessible annotation label.', nonEmptyString),
  nested('color', 'Color', 'Optional theme-aware CSS color.', annotationColor, false),
]);
const annotationBandY = object([
  nested('id', 'ID', 'Stable annotation identifier.', nonEmptyString),
  nested('type', 'Type', 'Reference band annotation.', { kind: 'enum', enumValues: ['band'] }),
  nested('axis', 'Axis', 'Axis that receives the band range.', { kind: 'enum', enumValues: ['y'] }),
  nested('start', 'Start', 'First axis value in the band.', stringOrNumber),
  nested('end', 'End', 'Second axis value in the band.', stringOrNumber),
  nested('label', 'Label', 'Accessible annotation label.', nonEmptyString),
  nested('color', 'Color', 'Optional theme-aware CSS color.', annotationColor, false),
]);
const cartesianAnnotationBandY = object([
  nested('id', 'ID', 'Stable annotation identifier.', nonEmptyString),
  nested('type', 'Type', 'Reference band annotation.', { kind: 'enum', enumValues: ['band'] }),
  nested('axis', 'Axis', 'Axis that receives the band range.', { kind: 'enum', enumValues: ['y'] }),
  nested('start', 'Start', 'First finite numeric axis value.', finiteNumber),
  nested('end', 'End', 'Second finite numeric axis value.', finiteNumber),
  nested('label', 'Label', 'Accessible annotation label.', nonEmptyString),
  nested('color', 'Color', 'Optional theme-aware CSS color.', annotationColor, false),
]);
const annotationPoint = object([
  nested('id', 'ID', 'Stable annotation identifier.', nonEmptyString),
  nested('type', 'Type', 'Point callout annotation.', { kind: 'enum', enumValues: ['point'] }),
  nested('x', 'X value', 'Horizontal axis value.', stringOrNumber),
  nested('y', 'Y value', 'Vertical axis value.', stringOrNumber),
  nested('label', 'Label', 'Accessible annotation label.', nonEmptyString),
  nested('color', 'Color', 'Optional theme-aware CSS color.', annotationColor, false),
]);
const cartesianAnnotationPoint = object([
  nested('id', 'ID', 'Stable annotation identifier.', nonEmptyString),
  nested('type', 'Type', 'Point callout annotation.', { kind: 'enum', enumValues: ['point'] }),
  nested('x', 'X value', 'Horizontal axis value.', stringOrNumber),
  nested('y', 'Y value', 'Finite vertical-axis value.', finiteNumber),
  nested('label', 'Label', 'Accessible annotation label.', nonEmptyString),
  nested('color', 'Color', 'Optional theme-aware CSS color.', annotationColor, false),
]);
const chartAnnotations = prop(
  'annotations',
  'Annotations',
  'Reference lines, range bands, and point callouts in chart data coordinates.',
  'data',
  array(
    {
      kind: 'union',
      variants: [
        annotationLineX,
        annotationLineY,
        annotationBandX,
        annotationBandY,
        annotationPoint,
      ],
    },
    'id',
    100
  ),
  false,
  []
);
const cartesianAnnotations = prop(
  'annotations',
  'Annotations',
  'Reference lines, range bands, and point callouts in chart data coordinates.',
  'data',
  array(
    {
      kind: 'union',
      variants: [
        annotationLineX,
        cartesianAnnotationLineY,
        annotationBandX,
        cartesianAnnotationBandY,
        cartesianAnnotationPoint,
      ],
    },
    'id',
    100
  ),
  false,
  []
);
const cartesianProps = [
  title,
  description,
  prop(
    'series',
    'Series',
    'Series and their nested x/y points.',
    'series',
    array(cartesianSeries, 'id'),
    true
  ),
  mode,
  cartesianAnnotations,
  prop(
    'renderer',
    'Renderer',
    'SVG, canvas, or automatic dense-series rendering.',
    'appearance',
    { kind: 'enum', enumValues: ['svg', 'canvas', 'auto'] },
    false,
    'auto'
  ),
  cssClass,
  prop(
    'interactive',
    'Interactive',
    'Enable keyboard chart exploration.',
    'interaction',
    { kind: 'boolean' },
    false,
    true
  ),
  prop(
    'brushInvert',
    'Brush inverse',
    'Developer callback that converts brush pixels into domain values.',
    'axes',
    { kind: 'event', signature: '(pixel: number) => number' },
    false,
    undefined,
    'developer'
  ),
  prop(
    'fullDomain',
    'Full domain',
    'Numeric x-axis domain used by zoom and reset controls.',
    'axes',
    { kind: 'tuple', items: [finiteNumber, finiteNumber] }
  ),
  prop(
    'visibleDomain',
    'Visible domain',
    'Numeric x-axis domain to render for a windowed cartesian series.',
    'axes',
    { kind: 'tuple', items: [finiteNumber, finiteNumber] }
  ),
  prop(
    'onzoom',
    'Zoom event',
    'Developer zoom event callback.',
    'interaction',
    { kind: 'event', signature: '(domain: [number, number]) => void' },
    false,
    undefined,
    'developer'
  ),
  prop(
    'onbrush',
    'Brush event',
    'Developer brush event callback.',
    'interaction',
    { kind: 'event', signature: '(domain: [number, number], pixels: BrushRange) => void' },
    false,
    undefined,
    'developer'
  ),
  prop(
    'onselect',
    'Select event',
    'Developer point-selection callback.',
    'interaction',
    { kind: 'event', signature: '(selection: ChartSelection) => void' },
    false,
    undefined,
    'developer'
  ),
] as const satisfies readonly ChartPropSchema[];

const partWholeLabels = prop(
  'labels',
  'Labels',
  'Localized labels for the accessible data table.',
  'localization',
  object([
    nested('table', 'Table action', 'Text that opens the data table.', nonEmptyString),
    nested('category', 'Category heading', 'Category column heading.', nonEmptyString),
    nested('value', 'Value heading', 'Value column heading.', nonEmptyString),
  ]),
  true
);
const partWholeDatum = object([
  nested('id', 'ID', 'Stable unique slice identifier.', nonEmptyString),
  nested('label', 'Label', 'Visible category label.', nonEmptyString),
  nested('value', 'Value', 'Finite slice value.', finiteNumber),
]);
const treeReference = { kind: 'reference', ref: 'tree-node' } as const;
const treeProp = prop(
  'root',
  'Root',
  'Recursive hierarchy rooted at this node.',
  'data',
  treeReference,
  true
);

const matrixPoint = (radiusRequired: boolean) =>
  object([
    nested('id', 'ID', 'Stable unique point identifier.', nonEmptyString),
    nested('label', 'Label', 'Accessible point label.', nonEmptyString),
    nested('x', 'X value', 'Finite horizontal-axis value.', finiteNumber),
    nested('y', 'Y value', 'Finite vertical-axis value.', finiteNumber),
    nested(
      'r',
      'Radius value',
      'Non-negative bubble size value.',
      nonNegativeNumber,
      radiusRequired
    ),
    nested('seriesId', 'Series ID', 'Optional series identifier.', nonEmptyString, false),
    nested(
      'color',
      'Color',
      'Optional CSS color.',
      { kind: 'string', constraints: { format: 'css-color' } },
      false
    ),
  ]);
const matrixSeries = object([
  nested('id', 'ID', 'Stable unique series identifier.', nonEmptyString),
  nested('label', 'Label', 'Visible and accessible series label.', nonEmptyString),
  nested(
    'color',
    'Color',
    'Optional CSS color.',
    { kind: 'string', constraints: { format: 'css-color' } },
    false
  ),
]);
const matrixBase = [
  title,
  description,
  mode,
  cssClass,
  width(640),
  height(360),
  prop(
    'interactive',
    'Interactive exploration',
    'Load keyboard navigation, snapped tooltip, and two-axis crosshair.',
    'interaction',
    { kind: 'boolean' },
    false,
    false
  ),
  chartAnnotations,
] as const;

const compactLabelFields = [
  nested('tableSummary', 'Table action', 'Text that opens the data table.', nonEmptyString),
  nested('measure', 'Measure heading', 'Measure column heading.', nonEmptyString),
  nested('point', 'Point heading', 'Point column heading.', nonEmptyString),
  nested('value', 'Value heading', 'Value column heading.', nonEmptyString),
  nested('noData', 'No data', 'Missing-value text.', nonEmptyString),
  nested('current', 'Current', 'Current-value label.', nonEmptyString),
  nested('minimum', 'Minimum', 'Minimum-value label.', nonEmptyString),
  nested('maximum', 'Maximum', 'Maximum-value label.', nonEmptyString),
  nested('target', 'Target', 'Target-value label.', nonEmptyString),
  nested('range', 'Range', 'Range label.', nonEmptyString),
  nested('complete', 'Complete', 'Completion label.', nonEmptyString),
  nested('total', 'Total', 'Total-value label.', nonEmptyString),
  nested('percent', 'Percent', 'Percentage label.', nonEmptyString),
] as const;
const compactLabelDefaults = {
  tableSummary: 'View data table',
  measure: 'Measure',
  point: 'Point',
  value: 'Value',
  noData: 'No data',
  current: 'Current',
  minimum: 'Minimum',
  maximum: 'Maximum',
  target: 'Target',
  range: 'Range',
  complete: 'Complete',
  total: 'Total',
  percent: 'Percent',
} as const;
const compactLabels = chartLabels(compactLabelFields, compactLabelDefaults);
const numberFormat = object([
  nested('type', 'Value kind', 'Format numeric values.', {
    kind: 'enum',
    enumValues: ['number'],
  }),
  nested('locale', 'Locale', 'Optional BCP 47 formatting locale.', stringValue, false),
  nested(
    'style',
    'Number style',
    'Decimal, percent, or currency display.',
    {
      kind: 'enum',
      enumValues: ['decimal', 'percent', 'currency'],
    },
    false
  ),
  nested(
    'currency',
    'Currency',
    'ISO 4217 code required for currency style.',
    nonEmptyString,
    false
  ),
  nested(
    'notation',
    'Notation',
    'Standard or compact magnitude notation.',
    {
      kind: 'enum',
      enumValues: ['standard', 'compact'],
    },
    false
  ),
  nested(
    'minimumFractionDigits',
    'Minimum fraction digits',
    'Minimum decimal places from zero to twenty.',
    {
      kind: 'number',
      constraints: { finite: true, integer: true, minimum: 0, maximum: 20 },
    },
    false
  ),
  nested(
    'maximumFractionDigits',
    'Maximum fraction digits',
    'Maximum decimal places from zero to twenty.',
    {
      kind: 'number',
      constraints: { finite: true, integer: true, minimum: 0, maximum: 20 },
    },
    false
  ),
]);
const dateFormat = object([
  nested('type', 'Value kind', 'Format epoch-millisecond values as dates.', {
    kind: 'enum',
    enumValues: ['date'],
  }),
  nested('locale', 'Locale', 'Optional BCP 47 formatting locale.', stringValue, false),
  nested('timeZone', 'Time zone', 'Optional IANA time zone.', nonEmptyString, false),
  nested(
    'dateStyle',
    'Date style',
    'Date display detail.',
    {
      kind: 'enum',
      enumValues: ['short', 'medium', 'long', 'full'],
    },
    false
  ),
  nested(
    'timeStyle',
    'Time style',
    'Time display detail.',
    {
      kind: 'enum',
      enumValues: ['short', 'medium', 'long', 'full'],
    },
    false
  ),
]);
const formatter = prop(
  'format',
  'Value format',
  'Declarative number or date formatting for visible and accessible values.',
  'localization',
  { kind: 'union', variants: [numberFormat, dateFormat] }
);

const flowLabelFields = [
  nested('tableSummary', 'Table action', 'Text that opens the data table.', nonEmptyString),
  nested('step', 'Step heading', 'Step column heading.', nonEmptyString),
  nested('count', 'Count heading', 'Count column heading.', nonEmptyString),
  nested('conversion', 'Conversion heading', 'Conversion column heading.', nonEmptyString),
  nested('from', 'From heading', 'Source column heading.', nonEmptyString),
  nested('to', 'To heading', 'Target column heading.', nonEmptyString),
  nested('value', 'Value heading', 'Value column heading.', nonEmptyString),
  nested('node', 'Node heading', 'Node column heading.', nonEmptyString),
  nested('connection', 'Connection heading', 'Connection column heading.', nonEmptyString),
] as const;
const flowLabelDefaults = {
  tableSummary: 'View data table',
  step: 'Step',
  count: 'Count',
  conversion: 'Conversion',
  from: 'From',
  to: 'To',
  value: 'Value',
  node: 'Node',
  connection: 'Connection',
} as const;
const flowLabels = chartLabels(flowLabelFields, flowLabelDefaults);
const flowNode = object([
  nested('id', 'ID', 'Stable unique node identifier.', nonEmptyString),
  nested('label', 'Label', 'Visible node label.', nonEmptyString, false),
]);
const networkNode = object([
  nested('id', 'ID', 'Stable unique node identifier.', nonEmptyString),
  nested('label', 'Label', 'Visible node label.', nonEmptyString, false),
  nested('value', 'Value', 'Optional positive node weight.', positiveNumber, false),
]);
const flowLink = object([
  nested('source', 'Source', 'Source node identifier.', nonEmptyString),
  nested('target', 'Target', 'Target node identifier.', nonEmptyString),
  nested('value', 'Value', 'Positive flow weight.', positiveNumber),
]);
const networkLink = object([
  nested('source', 'Source', 'Source node identifier.', nonEmptyString),
  nested('target', 'Target', 'Target node identifier.', nonEmptyString),
  nested('value', 'Value', 'Optional positive connection weight.', positiveNumber, false),
]);

const geoLabelFields = [
  nested('table', 'Table action', 'Text that opens the data table.', nonEmptyString),
  nested('region', 'Region heading', 'Region column heading.', nonEmptyString),
  nested('point', 'Point heading', 'Point column heading.', nonEmptyString),
  nested('location', 'Location heading', 'Location column heading.', nonEmptyString),
  nested('value', 'Value heading', 'Value column heading.', nonEmptyString),
  nested('noData', 'No data', 'Missing-value text.', nonEmptyString),
  nested('low', 'Low label', 'Low end of the legend.', nonEmptyString),
  nested('high', 'High label', 'High end of the legend.', nonEmptyString),
] as const;
const geoLabels = chartLabels(geoLabelFields, {
  table: 'View data table',
  region: 'Region',
  point: 'Point',
  location: 'Location',
  value: 'Value',
  noData: 'No data',
  low: 'Lower values',
  high: 'Higher values',
});
const geoTile = object([
  nested('id', 'ID', 'Stable unique region identifier.', nonEmptyString),
  nested('label', 'Label', 'Visible region label.', nonEmptyString),
  nested('abbr', 'Abbreviation', 'Short region abbreviation.', nonEmptyString),
  nested('col', 'Column', 'Integer tile column.', {
    kind: 'number',
    constraints: { finite: true, integer: true },
  }),
  nested('row', 'Row', 'Integer tile row.', {
    kind: 'number',
    constraints: { finite: true, integer: true },
  }),
]);
const geoShape = prop('shape', 'Shape', 'Schematic tile geometry.', 'layout', array(geoTile, 'id'));

const histogramLabels = chartLabels(
  [
    nested('table', 'Table action', 'Text that opens the data table.', nonEmptyString),
    nested('range', 'Range heading', 'Bin-range column heading.', nonEmptyString),
    nested('count', 'Count heading', 'Bin-count column heading.', nonEmptyString),
  ],
  { table: 'View data table', range: 'Range', count: 'Count' }
);
const packLabels = chartLabels(
  [
    nested('table', 'Table action', 'Text that opens the data table.', nonEmptyString),
    nested('category', 'Category heading', 'Category column heading.', nonEmptyString),
    nested('value', 'Value heading', 'Value column heading.', nonEmptyString),
  ],
  { table: 'View data table', category: 'Category', value: 'Value' }
);
const calendarLabels = chartLabels(
  [
    nested('table', 'Table action', 'Text that opens the data table.', nonEmptyString),
    nested('date', 'Date heading', 'Date column heading.', nonEmptyString),
    nested('value', 'Value heading', 'Value column heading.', nonEmptyString),
    nested('noData', 'No data', 'Missing-value text.', nonEmptyString),
  ],
  { table: 'View data table', date: 'Date', value: 'Value', noData: 'No data' }
);

const define = <const T extends ChartComponentPropSchema>(schema: T): T => schema;
const cartesian = <const Id extends string, const Component extends string>(
  id: Id,
  component: Component
) => define({ schemaVersion: 1, id, component, family: 'cartesian', props: cartesianProps });

export const lineChartSchema = cartesian('charts-line', 'LineChart');
export const areaChartSchema = cartesian('charts-area', 'AreaChart');
export const barChartSchema = cartesian('charts-bar', 'BarChart');
export const stackedBarChartSchema = cartesian('charts-stacked-bar', 'StackedBarChart');
export const comboChartSchema = cartesian('charts-combo', 'ComboChart');

export const pieChartSchema = define({
  schemaVersion: 1,
  id: 'charts-pie',
  component: 'PieChart',
  family: 'part-whole',
  props: [
    title,
    description,
    prop('data', 'Data', 'Flat slice data.', 'data', array(partWholeDatum, 'id'), true),
    partWholeLabels,
    prop('size', 'Size', 'Square view-box size in pixels.', 'layout', positiveNumber, false, 240),
    prop(
      'innerRatio',
      'Inner ratio',
      'Inner radius as a fraction of the outer radius.',
      'layout',
      { kind: 'number', constraints: { finite: true, minimum: 0, maximum: 0.85 } },
      false,
      0
    ),
    prop(
      'padAngle',
      'Pad angle',
      'Angular gap between slices in radians.',
      'layout',
      nonNegativeNumber,
      false,
      0.01
    ),
  ],
});
export const donutChartSchema = define({
  ...pieChartSchema,
  id: 'charts-donut',
  component: 'DonutChart',
  props: pieChartSchema.props.map((item) =>
    item.name === 'innerRatio' ? { ...item, default: 0.58 } : item
  ),
});
export const sunburstChartSchema = define({
  schemaVersion: 1,
  id: 'charts-sunburst',
  component: 'SunburstChart',
  family: 'part-whole',
  props: [
    title,
    description,
    treeProp,
    partWholeLabels,
    prop('size', 'Size', 'Square view-box size in pixels.', 'layout', positiveNumber, false, 240),
    prop(
      'innerRatio',
      'Inner ratio',
      'Inner radius as a fraction of the outer radius.',
      'layout',
      { kind: 'number', constraints: { finite: true, minimum: 0, maximum: 0.75 } },
      false,
      0.24
    ),
    prop(
      'padAngle',
      'Pad angle',
      'Angular gap between hierarchy arcs in radians.',
      'layout',
      nonNegativeNumber,
      false,
      0.008
    ),
  ],
});
export const treemapChartSchema = define({
  schemaVersion: 1,
  id: 'charts-treemap',
  component: 'TreemapChart',
  family: 'part-whole',
  props: [
    title,
    description,
    treeProp,
    partWholeLabels,
    width(640),
    height(360),
    prop('padding', 'Padding', 'Inner padding in pixels.', 'layout', nonNegativeNumber, false, 2),
  ],
});

const scatterProps = (radiusRequired: boolean) =>
  [
    title,
    description,
    prop(
      'points',
      'Points',
      'Nested quantitative points.',
      'data',
      array(matrixPoint(radiusRequired), 'id'),
      true
    ),
    prop(
      'series',
      'Series',
      'Optional series labels and colors.',
      'series',
      array(matrixSeries, 'id'),
      false,
      []
    ),
    ...matrixBase.slice(2),
  ] as const;
export const heatmapChartSchema = define({
  schemaVersion: 1,
  id: 'charts-heatmap',
  component: 'HeatmapChart',
  family: 'matrix',
  props: [
    title,
    description,
    prop(
      'cells',
      'Cells',
      'Matrix cells keyed by x and y categories.',
      'data',
      array(
        object([
          nested('x', 'X category', 'Horizontal category.', nonEmptyString),
          nested('y', 'Y category', 'Vertical category.', nonEmptyString),
          nested('value', 'Value', 'Finite cell value.', finiteNumber),
        ])
      ),
      true
    ),
    ...matrixBase.slice(2),
  ],
});
export const scatterChartSchema = define({
  schemaVersion: 1,
  id: 'charts-scatter',
  component: 'ScatterChart',
  family: 'matrix',
  props: scatterProps(false),
});
export const bubbleChartSchema = define({
  schemaVersion: 1,
  id: 'charts-bubble',
  component: 'BubbleChart',
  family: 'matrix',
  props: scatterProps(true),
});

export const sparklineSchema = define({
  schemaVersion: 1,
  id: 'charts-sparkline',
  component: 'Sparkline',
  family: 'compact',
  props: [
    prop(
      'values',
      'Values',
      'Ordered values; null creates a gap.',
      'data',
      array(nullableNumber),
      true
    ),
    label,
    optionalDescription,
    prop(
      'period',
      'Period',
      'Optional period text for the data table.',
      'accessibility',
      stringValue
    ),
    prop(
      'variant',
      'Variant',
      'Line, area, or bar rendering.',
      'appearance',
      { kind: 'enum', enumValues: ['line', 'area', 'bar'] },
      false,
      'line'
    ),
    formatter,
    height(32),
    prop(
      'showLast',
      'Show last value',
      'Show the latest finite value beside the sparkline.',
      'appearance',
      { kind: 'boolean' },
      false,
      true
    ),
    compactLabels,
  ],
});
export const bulletChartSchema = define({
  schemaVersion: 1,
  id: 'charts-bullet',
  component: 'BulletChart',
  family: 'compact',
  props: [
    label,
    optionalDescription,
    prop('value', 'Value', 'Current finite value.', 'data', finiteNumber, true),
    prop('max', 'Maximum', 'Maximum scale value.', 'axes', positiveNumber, false, 100),
    prop('target', 'Target', 'Optional target marker.', 'data', finiteNumber),
    prop(
      'ranges',
      'Ranges',
      'Ordered qualitative range boundaries.',
      'data',
      array(finiteNumber),
      false,
      []
    ),
    formatter,
    compactLabels,
  ],
});
export const gaugeSchema = define({
  schemaVersion: 1,
  id: 'charts-gauge',
  component: 'Gauge',
  family: 'compact',
  props: [
    label,
    optionalDescription,
    prop('value', 'Value', 'Current finite value.', 'data', finiteNumber, true),
    prop('min', 'Minimum', 'Minimum scale value.', 'axes', finiteNumber, false, 0),
    prop('max', 'Maximum', 'Maximum scale value.', 'axes', finiteNumber, false, 100),
    prop(
      'thresholds',
      'Thresholds',
      'Ordered band boundaries.',
      'data',
      array(finiteNumber),
      false,
      []
    ),
    prop(
      'bandLabels',
      'Band labels',
      'Labels aligned with threshold bands.',
      'localization',
      array(nonEmptyString),
      false,
      []
    ),
    formatter,
    prop('size', 'Size', 'Square rendered size in pixels.', 'layout', positiveNumber, false, 144),
    prop(
      'thickness',
      'Thickness',
      'Gauge stroke thickness in pixels.',
      'layout',
      positiveNumber,
      false,
      12
    ),
    compactLabels,
  ],
});
export const progressRingSchema = define({
  schemaVersion: 1,
  id: 'charts-progress-ring',
  component: 'ProgressRing',
  family: 'compact',
  props: [
    label,
    optionalDescription,
    prop('value', 'Value', 'Current finite value.', 'data', finiteNumber, true),
    prop('max', 'Maximum', 'Maximum progress value.', 'axes', positiveNumber, false, 100),
    formatter,
    prop('size', 'Size', 'Square rendered size in pixels.', 'layout', positiveNumber, false, 64),
    prop(
      'thickness',
      'Thickness',
      'Ring stroke thickness in pixels.',
      'layout',
      positiveNumber,
      false,
      7
    ),
    compactLabels,
  ],
});

export const funnelChartSchema = define({
  schemaVersion: 1,
  id: 'charts-funnel',
  component: 'FunnelChart',
  family: 'flow',
  props: [
    title,
    optionalDescription,
    prop(
      'steps',
      'Steps',
      'Ordered conversion steps.',
      'data',
      array(
        object([
          nested('id', 'ID', 'Stable unique step identifier.', nonEmptyString),
          nested('label', 'Label', 'Visible step label.', nonEmptyString, false),
          nested('value', 'Value', 'Finite step value.', finiteNumber),
        ]),
        'id'
      ),
      true
    ),
    prop(
      'orientation',
      'Orientation',
      'Direction of the funnel.',
      'layout',
      { kind: 'enum', enumValues: ['vertical', 'horizontal'] },
      false,
      'vertical'
    ),
    width(640),
    height(320),
    flowLabels,
    optionalCssClass,
  ],
});
export const sankeyChartSchema = define({
  schemaVersion: 1,
  id: 'charts-sankey',
  component: 'SankeyChart',
  family: 'flow',
  props: [
    title,
    optionalDescription,
    prop('nodes', 'Nodes', 'Unique flow nodes.', 'data', array(flowNode, 'id'), true),
    prop('links', 'Links', 'Weighted source-to-target flows.', 'data', array(flowLink), true),
    width(640),
    height(360),
    flowLabels,
    optionalCssClass,
  ],
});
export const networkGraphSchema = define({
  schemaVersion: 1,
  id: 'charts-network',
  component: 'NetworkGraph',
  family: 'flow',
  props: [
    title,
    optionalDescription,
    prop('nodes', 'Nodes', 'Unique graph nodes.', 'data', array(networkNode, 'id'), true),
    prop('links', 'Links', 'Source-to-target graph connections.', 'data', array(networkLink), true),
    width(480),
    height(360),
    flowLabels,
    optionalCssClass,
  ],
});

export const geoMapSchema = define({
  schemaVersion: 1,
  id: 'charts-geo-map',
  component: 'GeoMap',
  family: 'geo',
  props: [
    title,
    description,
    prop(
      'data',
      'Region values',
      'Region ID to finite value or null.',
      'data',
      { kind: 'record', values: nullableNumber },
      true
    ),
    geoShape,
    geoLabels,
    width(560),
    height(320),
  ],
});
export const geoPointMapSchema = define({
  schemaVersion: 1,
  id: 'charts-geo-point-map',
  component: 'GeoPointMap',
  family: 'geo',
  props: [
    title,
    description,
    prop(
      'points',
      'Points',
      'Points assigned to schematic regions.',
      'data',
      array(
        object([
          nested('id', 'ID', 'Stable unique point identifier.', nonEmptyString),
          nested('label', 'Label', 'Visible point label.', nonEmptyString),
          nested('regionId', 'Region ID', 'Referenced region identifier.', nonEmptyString),
          nested('value', 'Value', 'Finite point value or null.', nullableNumber),
          nested(
            'offset',
            'Offset',
            'Normalized x/y offset within the region.',
            object([
              nested('x', 'X offset', 'Horizontal offset from -0.4 to 0.4.', {
                kind: 'number',
                constraints: { finite: true, minimum: -0.4, maximum: 0.4 },
              }),
              nested('y', 'Y offset', 'Vertical offset from -0.4 to 0.4.', {
                kind: 'number',
                constraints: { finite: true, minimum: -0.4, maximum: 0.4 },
              }),
            ]),
            false
          ),
        ]),
        'id'
      ),
      true
    ),
    geoShape,
    geoLabels,
    width(560),
    height(320),
  ],
});

export const histogramChartSchema = define({
  schemaVersion: 1,
  id: 'charts-histogram',
  component: 'HistogramChart',
  family: 'histogram',
  props: [
    title,
    description,
    prop(
      'values',
      'Values',
      'Finite samples; null values are ignored.',
      'data',
      array(nullableNumber),
      true
    ),
    prop(
      'thresholds',
      'Thresholds',
      'Explicit ordered bin thresholds.',
      'bins',
      array(finiteNumber)
    ),
    prop('binCount', 'Bin count', 'Requested positive integer bin count.', 'bins', {
      kind: 'number',
      constraints: { finite: true, integer: true, minimum: 1 },
    }),
    prop('domain', 'Domain', 'Explicit numeric binning domain.', 'axes', {
      kind: 'tuple',
      items: [finiteNumber, finiteNumber],
    }),
    histogramLabels,
    width(640),
    height(320),
  ],
});
export const packChartSchema = define({
  schemaVersion: 1,
  id: 'charts-pack',
  component: 'PackChart',
  family: 'pack',
  props: [
    title,
    description,
    treeProp,
    packLabels,
    width(640),
    height(420),
    prop(
      'padding',
      'Padding',
      'Gap between packed circles in pixels.',
      'layout',
      nonNegativeNumber,
      false,
      2
    ),
  ],
});
const dateValue = {
  kind: 'union',
  variants: [{ kind: 'string', constraints: { nonEmpty: true, format: 'date' } }, finiteNumber],
} as const;
export const calendarHeatmapSchema = define({
  schemaVersion: 1,
  id: 'charts-calendar',
  component: 'CalendarHeatmap',
  family: 'calendar',
  props: [
    title,
    description,
    prop('start', 'Start', 'Inclusive ISO date or epoch milliseconds.', 'axes', dateValue, true),
    prop('end', 'End', 'Inclusive ISO date or epoch milliseconds.', 'axes', dateValue, true),
    prop(
      'values',
      'Values',
      'ISO date keys mapped to finite values. Maps are developer-only input; blueprints use records.',
      'data',
      { kind: 'record', values: finiteNumber }
    ),
    prop(
      'weekStartsOn',
      'Week starts on',
      'Day index from Sunday (0) through Saturday (6).',
      'layout',
      { kind: 'number', constraints: { finite: true, integer: true, minimum: 0, maximum: 6 } },
      false,
      1
    ),
    prop('cellSize', 'Cell size', 'Day-cell size in pixels.', 'layout', positiveNumber, false, 12),
    prop('gap', 'Gap', 'Gap between day cells in pixels.', 'layout', nonNegativeNumber, false, 2),
    calendarLabels,
  ],
});

/** Recursive definitions shared by schemas through `reference` nodes. */
export const chartSchemaDefinitions = {
  'tree-node': object([
    nested('id', 'ID', 'Stable unique node identifier.', nonEmptyString),
    nested('label', 'Label', 'Visible node label.', nonEmptyString, false),
    nested('value', 'Value', 'Finite non-negative leaf value.', nonNegativeNumber, false),
    nested('children', 'Children', 'Nested child nodes.', array(treeReference, 'id'), false),
  ]),
} as const satisfies ChartSchemaDefinitions;

/** All blueprint-rendered chart component schemas, keyed by stable catalog-style ID. */
export const chartPropSchemas = {
  [lineChartSchema.id]: lineChartSchema,
  [areaChartSchema.id]: areaChartSchema,
  [barChartSchema.id]: barChartSchema,
  [stackedBarChartSchema.id]: stackedBarChartSchema,
  [comboChartSchema.id]: comboChartSchema,
  [pieChartSchema.id]: pieChartSchema,
  [donutChartSchema.id]: donutChartSchema,
  [sunburstChartSchema.id]: sunburstChartSchema,
  [treemapChartSchema.id]: treemapChartSchema,
  [heatmapChartSchema.id]: heatmapChartSchema,
  [scatterChartSchema.id]: scatterChartSchema,
  [bubbleChartSchema.id]: bubbleChartSchema,
  [sparklineSchema.id]: sparklineSchema,
  [bulletChartSchema.id]: bulletChartSchema,
  [gaugeSchema.id]: gaugeSchema,
  [progressRingSchema.id]: progressRingSchema,
  [funnelChartSchema.id]: funnelChartSchema,
  [sankeyChartSchema.id]: sankeyChartSchema,
  [networkGraphSchema.id]: networkGraphSchema,
  [geoMapSchema.id]: geoMapSchema,
  [geoPointMapSchema.id]: geoPointMapSchema,
  [histogramChartSchema.id]: histogramChartSchema,
  [packChartSchema.id]: packChartSchema,
  [calendarHeatmapSchema.id]: calendarHeatmapSchema,
} as const satisfies Readonly<Record<string, ChartComponentPropSchema>>;

export type ChartSchemaId = keyof typeof chartPropSchemas;
