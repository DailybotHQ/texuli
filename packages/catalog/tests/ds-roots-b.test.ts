import { cleanup, render } from '@testing-library/svelte';
import type { Component } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { CanvasRenderer } from '../../charts/src/canvas/index.ts';
import {
  AreaChart,
  BarChart,
  CartesianChart,
  ComboChart,
  LineChart,
  StackedBarChart,
} from '../../charts/src/cartesian/index.ts';
import { BulletChart, Gauge, ProgressRing, Sparkline } from '../../charts/src/compact/index.ts';
import { FunnelChart, NetworkGraph, SankeyChart } from '../../charts/src/flow/index.ts';
import { GeoMap, GeoPointMap } from '../../charts/src/geo/index.ts';
import { BubbleChart, HeatmapChart, ScatterChart } from '../../charts/src/matrix/index.ts';
import {
  DonutChart,
  PieChart,
  SunburstChart,
  TreemapChart,
} from '../../charts/src/part-whole/index.ts';
import { ChatMessageDisplay, ChatThreadDisplay } from '../../chat/src/display/index.ts';
import { NotificationInbox } from '../../data/src/activity/inbox/index.ts';
import { Board } from '../../data/src/board/index.ts';
import { CalendarView } from '../../data/src/calendar/index.ts';
import { CohortTable } from '../../data/src/cohort/index.ts';
import { Dashboard } from '../../data/src/dashboard/index.ts';
import { FileBrowser } from '../../data/src/files/index.ts';
import { FilterBuilder } from '../../data/src/filter-builder/index.ts';
import { DataGrid } from '../../data/src/grid-core/index.ts';
import { MapView } from '../../data/src/map/index.ts';
import { TimelineView } from '../../data/src/timeline/index.ts';
import { TreeDataView } from '../../data/src/tree-view/index.ts';
import BoardHarness from '../../data/tests/fixtures/BoardHarness.svelte';
import DashboardHarness from '../../data/tests/fixtures/DashboardHarness.svelte';
import TreeDataViewHarness from '../../data/tests/fixtures/TreeDataViewHarness.svelte';
import { CompositionCanvas } from '../../media/src/composition-canvas/index.ts';
import { CompositionSvg } from '../../media/src/composition-svg/index.ts';
import Image from '../../media/src/image/Image.svelte';
import {
  DS_COMPONENT_ATTRIBUTE,
  DS_DENSITY_ATTRIBUTE,
  DS_SIZE_ATTRIBUTE,
  DS_TONE_ATTRIBUTE,
  DS_VARIANT_ATTRIBUTE,
} from '../../spec/src/design-system/attributes.ts';
import { buildCatalog } from '../src/build/build.ts';
import { ALL_MANIFEST_GROUPS } from '../src/manifests/all.ts';
import { renderCatalogFromBuild, renderCatalogTree } from '../src/render/renderer/index.ts';

const GROUP_B_IDS = [
  'charts-area',
  'charts-bar',
  'charts-bubble',
  'charts-bullet',
  'charts-canvas-renderer',
  'charts-cartesian',
  'charts-combo',
  'charts-donut',
  'charts-funnel',
  'charts-gauge',
  'charts-geo-map',
  'charts-geo-point-map',
  'charts-heatmap',
  'charts-line',
  'charts-network',
  'charts-pie',
  'charts-progress-ring',
  'charts-sankey',
  'charts-scatter',
  'charts-sparkline',
  'charts-stacked-bar',
  'charts-sunburst',
  'charts-treemap',
  'chat-message',
  'chat-thread',
  'data-board',
  'data-calendar',
  'data-cohort-table',
  'data-dashboard',
  'data-dashboard-widget',
  'data-files',
  'data-filter-builder',
  'data-grid',
  'data-map',
  'data-notification-inbox',
  'data-timeline',
  'data-tree-view',
  'media-composition-canvas',
  'media-composition-svg',
  'media-image',
] as const;

type GroupBId = (typeof GROUP_B_IDS)[number];
type Axis = 'variant' | 'size' | 'tone' | 'density';
const ATTRIBUTE_FOR_AXIS: Readonly<Record<Axis, string>> = {
  variant: DS_VARIANT_ATTRIBUTE,
  size: DS_SIZE_ATTRIBUTE,
  tone: DS_TONE_ATTRIBUTE,
  density: DS_DENSITY_ATTRIBUTE,
};
const COMPONENTS = {
  'charts-area': AreaChart,
  'charts-bar': BarChart,
  'charts-bubble': BubbleChart,
  'charts-bullet': BulletChart,
  'charts-canvas-renderer': CanvasRenderer,
  'charts-cartesian': CartesianChart,
  'charts-combo': ComboChart,
  'charts-donut': DonutChart,
  'charts-funnel': FunnelChart,
  'charts-gauge': Gauge,
  'charts-geo-map': GeoMap,
  'charts-geo-point-map': GeoPointMap,
  'charts-heatmap': HeatmapChart,
  'charts-line': LineChart,
  'charts-network': NetworkGraph,
  'charts-pie': PieChart,
  'charts-progress-ring': ProgressRing,
  'charts-sankey': SankeyChart,
  'charts-scatter': ScatterChart,
  'charts-sparkline': Sparkline,
  'charts-stacked-bar': StackedBarChart,
  'charts-sunburst': SunburstChart,
  'charts-treemap': TreemapChart,
  'chat-message': ChatMessageDisplay,
  'chat-thread': ChatThreadDisplay,
  'data-board': Board,
  'data-calendar': CalendarView,
  'data-cohort-table': CohortTable,
  'data-dashboard': Dashboard,
  'data-files': FileBrowser,
  'data-filter-builder': FilterBuilder,
  'data-grid': DataGrid,
  'data-map': MapView,
  'data-notification-inbox': NotificationInbox,
  'data-timeline': TimelineView,
  'data-tree-view': TreeDataView,
  'media-composition-canvas': CompositionCanvas,
  'media-composition-svg': CompositionSvg,
  'media-image': Image,
} as unknown as Readonly<
  Record<Exclude<GroupBId, 'data-dashboard-widget'>, Component<Record<string, unknown>>>
>;

afterEach(cleanup);

function exampleProps(entry: (typeof ALL_MANIFEST_GROUPS)[number]['manifests'][number]) {
  const example = entry.examples?.[0]?.props ?? {};
  const props: Record<string, unknown> = structuredClone(example);
  for (const prop of entry.props) {
    if (prop.required && props[prop.name] === undefined) {
      switch (prop.kind) {
        case 'string':
          props[prop.name] = 'Example';
          break;
        case 'number':
          props[prop.name] = 1;
          break;
        case 'boolean':
          props[prop.name] = false;
          break;
        case 'enum':
          props[prop.name] = prop.enumValues?.[0] ?? example[prop.name];
          break;
        case 'array':
          props[prop.name] = [];
          break;
        case 'object':
          props[prop.name] = example[prop.name] ?? {};
          break;
        default:
          props[prop.name] = example[prop.name];
      }
    }
    if (
      (prop.name === 'variant' ||
        prop.name === 'size' ||
        prop.name === 'tone' ||
        prop.name === 'density') &&
      prop.kind === 'enum' &&
      prop.enumValues?.[0]
    ) {
      props[prop.name] = prop.enumValues[0];
    }
  }
  return props;
}

describe('Group B catalog component root attributes', () => {
  it('covers the audited data, charts, media, and chat ids', async () => {
    const entries = ALL_MANIFEST_GROUPS.flatMap((group) => group.manifests).filter((entry) =>
      ['@texuli/data', '@texuli/charts', '@texuli/media', '@texuli/chat'].includes(entry.package)
    );
    expect(entries.map((entry) => entry.id).sort()).toEqual([...GROUP_B_IDS].sort());
  });

  it('renders every catalog node and checks its actual component root and enum axes', async () => {
    const entries = ALL_MANIFEST_GROUPS.flatMap((group) => group.manifests).filter((entry) =>
      (GROUP_B_IDS as readonly string[]).includes(entry.id)
    );
    const { catalog } = await buildCatalog(ALL_MANIFEST_GROUPS);
    const rendererCatalog = renderCatalogFromBuild(catalog, { developer: 'all' });

    for (const entry of entries) {
      const props = exampleProps(entry);
      const rendered = renderCatalogTree(
        { id: entry.id, props },
        { catalog: rendererCatalog, tier: 'developer' }
      );
      expect(rendered.diagnostics, entry.id).toEqual([]);
      const node = rendered.roots[0];
      expect(node?.kind, entry.id).toBe('component');
      if (node?.kind !== 'component') throw new Error(`Catalog did not render ${entry.id}`);

      const view =
        entry.id === 'data-dashboard-widget'
          ? render(DashboardHarness, {
              props: {
                widgets: [{ id: String(node.props.widgetId), title: String(node.props.title) }],
              },
            })
          : entry.id === 'data-board'
            ? render(BoardHarness)
            : entry.id === 'data-tree-view'
              ? render(TreeDataViewHarness)
              : entry.id === 'data-grid'
                ? render(DataGrid, {
                    props: {
                      caption: 'Example rows',
                      columns: [{ key: 'name', header: 'Name' }],
                      rows: [{ id: 'row-1', name: 'Example' }],
                      getRowId: (row) => String((row as { id: string }).id),
                      density: node.props.density as 'compact' | 'default' | 'comfortable',
                    },
                  })
                : render(COMPONENTS[entry.id as Exclude<GroupBId, 'data-dashboard-widget'>], {
                    props: {
                      ...(node.props as Record<string, unknown>),
                    },
                  });
      const root =
        entry.id === 'data-dashboard-widget'
          ? view.container.querySelector(`[${DS_COMPONENT_ATTRIBUTE}="${entry.id}"]`)
          : view.container.firstElementChild;
      expect(root, entry.id).not.toBeNull();
      expect(root?.getAttribute(DS_COMPONENT_ATTRIBUTE), entry.id).toBe(entry.id);

      for (const axis of ['variant', 'size', 'tone', 'density'] as const) {
        const prop = entry.props.find(
          (candidate) => candidate.name === axis && candidate.kind === 'enum'
        );
        if (!prop || (entry.id === 'data-dashboard' && axis === 'density')) continue;
        expect(root?.getAttribute(ATTRIBUTE_FOR_AXIS[axis]), `${entry.id} ${axis}`).toBe(
          String(node.props[axis])
        );
      }
    }
  }, 120_000);
});
