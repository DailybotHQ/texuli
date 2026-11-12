## Status and release

The dashboard grid and engine are available in `@texuli/data@0.17.4`, a pre-1.0 release that is still in development. The `FilterBar` and `MetricCard` additions were made after `0.17.4`; they need a later `@texuli/data` release. A new minor release under 0.x may introduce breaking changes.

## Host responsibilities

- The host fetches, validates, formats and refreshes data.
- The host chooses where layouts and filters are stored and who can access them.
- Texuli does not provide a hosted dashboard service, collaboration, or automatic persistence.
- Adding and removing widgets from an existing board is a host action.
- Sync integration with `@texuli/document/sync` is planned, not implemented.

The Solutions demo uses fictional, local sample data only. It is not a production analytics connection.
