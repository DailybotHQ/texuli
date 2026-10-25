# KMPTodoApp migration validation

KMPTodoApp is a separate developer project under `~/AndroidStudioProjects`,
outside this repository. This lane inspected its common Compose source and did
not modify the app. The task-list display is captured as
[`conformance/fixtures/kmp-todo.json`](../conformance/fixtures/kmp-todo.json)
and held by `KmpTodoMigrationTest`; this is a migration validation fixture, not
a port of the app.

## Task-list mapping

| App surface | Blueprint representation | Native status today |
| --- | --- | --- |
| `Scaffold` / task-list page title | `layout-page` | `IMPLEMENTED` |
| Task-list heading and static item summaries | `blocks-text` heading and list block | `IMPLEMENTED` |
| Grouped task-list surface | `layout-card` | `IMPLEMENTED` |
| Search field (`OutlinedTextField`) | No blueprint node in the fixture; `input` is not emitted | `PLACEHOLDER` registry status; remains app code |
| All/active/done filters (`FilterChip`) | No blueprint node in the fixture; `chip` is not emitted | `PLACEHOLDER` registry status; remains app code |
| Completion toggle (`Checkbox`) | No blueprint node in the fixture; `checkbox` is not emitted | `PLACEHOLDER` registry status; remains app code |
| Create, clear-completed, share, delete and settings actions | No blueprint node in the fixture; `button` is not emitted | `PLACEHOLDER` registry status; remains app code |

The fixture uses only fictional task summaries. It deliberately does not
encode repository/database state, callbacks, view-model behavior, navigation,
or interactive controls. Those catalog controls have empty emission lists;
the validation test pins that boundary and their current native registry
status. The blueprint therefore demonstrates static display projection, not
functional Todo migration.

## Gaps and scope

The source app also has task-edit and settings screens, persistent task and
theme state, due-date selection, filtering, completion, deletion, sharing, and
empty/loading states. They remain app-specific Compose behavior and are not
represented by this single task-list fixture. Native support for the page,
card, heading, and text-list widgets does not imply native support for the
Todo app's controls or data flows. A complete migration needs typed
state/event bindings and native implementations for the currently
non-emittable controls; those are not added here.

## Validation

Run `KmpTodoMigrationTest` as part of the native `check` gate. If a fixture
widget gains or loses a native binding, this test fails until its status and
this mapping table are reviewed together. The external KMPTodoApp remains
unchanged.
