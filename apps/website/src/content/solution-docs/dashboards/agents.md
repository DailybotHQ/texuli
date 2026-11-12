## Agent-authored dashboards

The catalog describes dashboards with `data-dashboard` and `data-dashboard-widget` nodes. Widget bodies are ordinary catalog components. Metric data comes from a source registered by the host; the blueprint does not supply executable code or an arbitrary fetch URL.

`@texuli/catalog` checks that widgets are direct children of a dashboard, widget ids are unique, and the dashboard has at most 200 widgets. The host validates the draft and decides whether it is suitable to render.

## Keep agent data untrusted

Parse stored layouts with `parseDashboard` and use the catalog validation path for blueprint content. Treat text, metric values, saved filters, and layout JSON as data. Do not turn them into HTML or construct a network request from an agent-provided string.

## Skill

The Texuli skill's dashboard recipe covers the dashboard grid, widget composition, filters, metrics and visual validation. Use only the APIs available in the installed package version; `FilterBar` and `MetricCard` require a release newer than `0.17.4` and need a later `@texuli/data` release.
