# Core expression

`@texuli/core/expression` is the one bounded expression language of
ADR-015. Agents never ship code: a condition, a computed value or a
validation rule is a closed JSON AST that this texel validates, analyzes and
evaluates in a bounded number of steps. `@texuli/forms` evaluates its
conditional logic and cross-field rules with it; the planned
`@texuli/sheets/formula` layer extends it (see [Extending](#extending)).
Framework-free, subpath only (`@texuli/core` does not re-export it).

```ts
import {
  evaluateExpression,
  isTrue,
  parseExpression,
  parseExpressionText,
} from '@texuli/core/expression';

// The JSON form (what agents and blueprints carry):
const parsed = parseExpression({
  op: 'and',
  args: [
    { op: 'gte', left: { op: 'field', name: 'age' }, right: { op: 'num', value: 18 } },
    { op: 'call', fn: 'includes', args: [{ op: 'field', name: 'topics' }, { op: 'str', value: 'beta' }] },
  ],
});
// The text form (for developers; it compiles to the same AST):
const same = parseExpressionText('age >= 18 and includes(topics, "beta")');

if (parsed.ok) {
  const value = evaluateExpression(parsed.expression, {
    field: (name) => answers[name],
  });
  isTrue(value); // only `true` counts as true
}
```

## The AST

Every node is an object with an `op` (`ExpressionNode`, `ExpressionOp`,
`EXPRESSION_OPS`); unknown ops and unknown members are refused.

| Group | Ops |
| --- | --- |
| Literals | `num` (`value`, finite), `str` (`value`, at most 32 KB), `bool`, `null` |
| References | `field` and `var` (`name`, `EXPRESSION_NAME`), `ref` and `range` (only when a dialect enables them) |
| Arithmetic | `add`, `sub`, `mul`, `div`, `mod` (`left`, `right`; `ExpressionArithmeticOp`), `pow` (`base`, `exponent`, at most ±64), `neg` (`value`) |
| Comparison | `lt`, `lte`, `gt`, `gte`, `eq`, `neq` (`ExpressionComparisonOp`) |
| Logic | `and`, `or` (`args`), `not` (`value`), `if` (`test`, `ifTrue`, `ifFalse`) |
| Numbers and text | `min`, `max`, `concat` (`args`), `round` (`value`, optional `digits` from -12 to 12, half away from zero), `clamp` (`value`, `min`, `max`) |
| Calls | `call` (`fn`, `args`): a function the caller's table holds |

The blueprint spec's `numberFormula` and `condition` shapes (ADR-008) are a
subset, so every formula a blueprint already carries is a valid expression.

`parseExpression(input, options)` (`ExpressionParseOptions`: `functions`,
`references`) returns an `ExpressionParseResult`: either a frozen
`Expression` (the normalized `ast`, its `nodes` and `depth`, and its
dependencies: `fields`, `functions`, `refs`, `ranges`) or
`ExpressionDiagnostic`s (`code`: an `ExpressionDiagnosticCode` such as
`unknown-op`, `unknown-function`, `arity`, `refs-disabled`, `too-deep`,
`too-many-nodes`; a JSON `path`; a `message`). `expressionChildren(node)`
lists a node's child nodes.

## The text form

`parseExpressionText(source, options)` reads a small infix syntax into the
same AST, then validates it with `parseExpression`:

- numbers (`12`, `0.5`, `1e3`), strings in single or double quotes with
  `\\`, `\"`, `\'`, `\n`, `\t`, `\r` escapes, `true`, `false`, `null`;
- names read fields (`{ op: "field" }`);
- operators by precedence: `or` / `||`; `and` / `&&`; `not` / `!`; the
  comparisons `==` (or `=`), `!=` (or `<>`), `<`, `<=`, `>`, `>=`, which do
  not chain; `&` (concatenation); `+`, `-`; `*`, `/`, `%`; unary `-`; `^`
  (right-associative, above unary minus, so `-2 ^ 2` is `-4`);
- calls: `if`, `min`, `max`, `concat`, `round` (digits must be a literal) and
  `clamp` map to their ops; any other name must be in the function table.

Chains of `and`, `or` and `&` become one list node; `+`, `-`, `*` and `/`
nest to the left, so the depth limit allows at most 32 terms in one sum.
Syntax errors carry a text offset (`@12`). `formatExpression(ast)` prints an
AST back as text that parses to an equivalent expression.

## Evaluation

`evaluateExpression(expression, env, options)` returns an `ExpressionValue`:
an `ExpressionScalar` (a number, string, boolean or `null`), a flat list of
scalars, or an `ExpressionError`. It never throws.

- **Inputs** come from an `ExpressionEnv`: `field(name)` for `field` and
  `var`, `ref` and `range` for dialect references, and `now()` for
  `today()`. Values are normalized (`toExpressionValue`): non-finite numbers
  read as `null`, objects as `#VALUE!`, oversized strings and lists as
  `#LIMIT!`. Hosts should look names up with `Object.hasOwn` so a field
  named `constructor` reads nothing.
- **Three-valued logic.** `null` is "unknown": arithmetic and ordering with
  it stay `null`, `and` is false when any operand is false and unknown when
  any is unknown, `or` mirrors it, `not null` is `null`, and `if` with an
  unknown test takes `ifFalse`. `isTrue(value)` is true only for `true`, so
  a condition over an empty answer does not hold.
- **Comparisons**: numbers numerically, strings by code unit (ISO dates
  `YYYY-MM-DD` therefore compare as dates), booleans; lists only with `eq`
  and `neq`; other mixes are `#VALUE!`.
- **Errors** (`ExpressionErrorCode`): `#DIV/0!`, `#VALUE!`, `#REF!`
  (a reference the env cannot resolve), `#NAME?` (a function missing from
  the table), `#NUM!` (a non-finite result, a `pow` past ±64, an impossible
  date), `#N/A` (`today()` with no host clock), `#CYCLE!` (reserved for the
  sheets dependency graph) and `#LIMIT!`. Errors propagate through operators
  and calls. `expressionError(code)` returns the shared value,
  `isExpressionError(value)` tests for one.
- **Options** (`ExpressionEvaluateOptions`): `functions`, `budget`, `steps`
  (lowers the per-expression cap; it cannot raise it), `blank` (`zero`
  reads empty operands as 0 or the empty string, as spreadsheets do) and
  `caseInsensitive`. `roundHalfAway(value, digits)` is the rounding `round`
  uses.

## Functions

`CORE_FUNCTIONS` is the default table (`ExpressionFunctionTable`). Each
entry is an `ExpressionFunction` (`minArgs`, `maxArgs`, `params` and
`returns` as `ExpressionType`s, optional `acceptsErrors`, `call(args,
context)` with an `ExpressionFunctionContext` that can `charge` steps and
read `now`).

| Function | Result |
| --- | --- |
| `len(value)` | characters in a string or items in a list |
| `lower`, `upper`, `trim` | text transforms |
| `contains`, `startsWith`, `endsWith` | case-sensitive text tests |
| `isEmpty(value)` | null, a blank string or an empty list |
| `coalesce(a, b, …)` | the first non-empty argument |
| `includes(list, value)`, `count(list)`, `sum(list)` | lists (multiple choice, tags) |
| `abs`, `floor`, `ceil`, `number(text)` | numbers; `number` reads plain decimals only |
| `today()` | the host clock's UTC day |
| `date(y, m, d)`, `isDate`, `daysBetween`, `addDays`, `year`, `month`, `day` | ISO dates |

`isoDateToDays` and `daysToIsoDate` convert between `YYYY-MM-DD` and days
since 1970-01-01 (proleptic Gregorian, years 0000 to 9999).

## Static analysis

`analyzeExpression(expression, options)` (`ExpressionAnalysisOptions`:
declared `fields` with their `ExpressionType`, the `functions` table and the
`expect`ed result type) returns an `ExpressionAnalysis`: the inferred
`type` and `type` or `unknown-field` diagnostics. `isAssignable(actual,
expected)` is its compatibility rule (`any` and `null` fit anywhere, dates
and strings interchange).

## Limits

`EXPRESSION_LIMITS` (ADR-015): at most 1,000 nodes and depth 32 per
expression; 100,000 evaluation steps per expression and 10,000,000 per
recalculation pass; strings at most 32,768 code units and lists at most
10,000 items; at most 64 arguments per list node; expression text at most
16,384 characters. Each node visit costs a step and functions charge one
step per 16 code units they scan or per list item, so limits are
deterministic. Parse-time limits are diagnostics; run-time limits are
`#LIMIT!`, never an exception or a hang.

`createExpressionBudget(limit)` makes an `ExpressionBudget` (`limit`,
`used`, `exhausted`, `spend`) shared by every evaluation of one pass; once
spent, each further evaluation is `#LIMIT!`.

Tests (`packages/core/tests/expression.test.ts`) cover a 100,000-level
object, 16,000 open parentheses and unary chains (refused at depth 33 in
linear time), the exact node and depth limits, step exhaustion on 32 KB
strings, a shared pass budget, string and list caps, functions that throw,
and names such as `constructor` that must reach nothing.

## Extending

The planned `@texuli/sheets/formula` layer (ADR-015) reuses this core
instead of forking it:

- **Its own grammar.** Sheets parse `=SUM(A1:B3)` with their own linear
  parser into this AST: cells become `ref` nodes and intervals `range`
  nodes, and the result passes through `parseExpression` with a
  `references` dialect (`ExpressionReferenceDialect.isRef`) so every
  reference is checked and every node limit holds. Without a dialect (as in
  forms) `ref` and `range` are refused.
- **Static dependencies.** `Expression.refs` and `Expression.ranges` list
  what a formula reads (ranges stay intervals, never expanded), which is
  what a dependency graph needs; nothing builds a reference from text.
- **Its own function table.** Sheets pass a table (for example
  `{ ...CORE_FUNCTIONS, SUM, IFERROR }`); `acceptsErrors` lets an
  `IFERROR` see error arguments, and `charge` keeps range work bounded.
- **Spreadsheet semantics.** `blank: 'zero'` and `caseInsensitive: true`.
- **One budget per recalculation pass** through `createExpressionBudget`;
  `#CYCLE!` is reserved for the graph's cycle report.
