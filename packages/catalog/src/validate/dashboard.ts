import type { RenderNode } from '../render/renderer/types.ts';

/**
 * Dashboards in blueprints (spec 0.8.0, PLAN_010 T-dashboard). The
 * composition rules the prop schemas cannot say, checked on the render tree
 * by `validateDraft` and reported under its `render` check:
 *
 * - a `data-dashboard` holds only `data-dashboard-widget` children, at most
 *   {@link MAX_DASHBOARD_WIDGETS} (`dashboard-child`, `dashboard-widgets`);
 * - a `data-dashboard-widget` sits directly in a `data-dashboard`
 *   (`dashboard-parent`);
 * - every widget's `widgetId` is an id (letters, digits, `-` and `_`, at
 *   most 64 characters) and unique in its dashboard (`dashboard-widget-id`).
 *
 * Widget content stays ordinary catalog nodes, so data reaches a widget only
 * through host-registered sources (`$source`), never URLs or code. Pure,
 * iterative and linear in the tree; never throws.
 */

export const DASHBOARD_ID = 'data-dashboard';
export const DASHBOARD_WIDGET_ID = 'data-dashboard-widget';
/** The widget cap of `@texuli/data/dashboard/engine` (`DASHBOARD_LIMITS.widgets`). */
export const MAX_DASHBOARD_WIDGETS = 200;

const WIDGET_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export interface DashboardFinding {
  code: 'dashboard-child' | 'dashboard-parent' | 'dashboard-widgets' | 'dashboard-widget-id';
  path: string;
  message: string;
}

/** Findings reported per draft, so a hostile tree cannot flood the receipt. */
export const MAX_DASHBOARD_FINDINGS = 20;

export function checkDashboards(roots: readonly RenderNode[]): DashboardFinding[] {
  const findings: DashboardFinding[] = [];
  const add = (finding: DashboardFinding) => {
    if (findings.length < MAX_DASHBOARD_FINDINGS) findings.push(finding);
  };
  const stack: { node: RenderNode; path: string; parent: string | null }[] = roots
    .map((node, index) => ({ node, path: String(index), parent: null }))
    .reverse();
  while (stack.length > 0) {
    const { node, path, parent } = stack.pop() as (typeof stack)[number];
    if (node.kind !== 'component') continue;
    if (node.id === DASHBOARD_WIDGET_ID && parent !== DASHBOARD_ID) {
      add({
        code: 'dashboard-parent',
        path,
        message: `A ${DASHBOARD_WIDGET_ID} belongs directly inside a ${DASHBOARD_ID}.`,
      });
    }
    if (node.id === DASHBOARD_ID) {
      const seen = new Set<string>();
      let widgets = 0;
      node.children.forEach((child, i) => {
        const at = `${path}.children.${i}`;
        if (child.kind !== 'component' || child.id !== DASHBOARD_WIDGET_ID) {
          add({
            code: 'dashboard-child',
            path: at,
            message: `A ${DASHBOARD_ID} holds only ${DASHBOARD_WIDGET_ID} children.`,
          });
          return;
        }
        widgets += 1;
        const widgetId = child.props.widgetId;
        if (typeof widgetId !== 'string' || !WIDGET_ID.test(widgetId)) {
          add({
            code: 'dashboard-widget-id',
            path: at,
            message:
              'widgetId is letters, digits, "-" and "_" (at most 64 characters, starting with a letter or digit).',
          });
        } else if (seen.has(widgetId)) {
          add({
            code: 'dashboard-widget-id',
            path: at,
            message: `widgetId "${widgetId}" is used twice in this dashboard.`,
          });
        } else {
          seen.add(widgetId);
        }
      });
      if (widgets > MAX_DASHBOARD_WIDGETS) {
        add({
          code: 'dashboard-widgets',
          path,
          message: `A dashboard holds at most ${MAX_DASHBOARD_WIDGETS} widgets.`,
        });
      }
    }
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      stack.push({
        node: node.children[i] as RenderNode,
        path: `${path}.children.${i}`,
        parent: node.id,
      });
    }
  }
  return findings;
}
