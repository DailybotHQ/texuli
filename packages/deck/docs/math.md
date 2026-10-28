# Math (`@texuli/deck/math`)

An owned TeX subset that converts to a MathML node tree (ADR-009, math
policy). There is no third-party math library and no markup string: the
converter returns plain objects built only from a closed set of MathML Core
elements and attributes, and a renderer walks that tree. Nothing here can
reach an HTML sink.

> **Status:** in development; `@texuli/deck` is on npm from `0.4.0`. Block
> math (`$$ … $$` in the [Markdown dialect](markdown.md#math), or a
> `{ "type": "math", "tex": "…" }` block in JSON) is supported. Inline `$…$`
> inside text blocks stays as written; rendering it needs an opt-in in
> `@texuli/blocks` and is a follow-up.

```ts
import { mathText, texToMath } from '@texuli/deck/math';

const result = texToMath('\\frac{a}{b} + x^2', { display: true });
// result.ok === true
// result.node: { tag: 'math', attrs: { display: 'block' }, children: [
//   { tag: 'mfrac', children: [{ tag: 'mi', text: 'a' }, { tag: 'mi', text: 'b' }] },
//   { tag: 'mo', text: '+' },
//   { tag: 'msup', children: [{ tag: 'mi', text: 'x' }, { tag: 'mn', text: '2' }] },
// ] }

mathText(result.node); // 'ab+x2' (plain text for accessible names, text twins and PPTX)
```

## API

- `texToMath(tex, options?)` returns a `MathResult`: `ok`, the `math` root
  `node` and `issues`. `TexToMathOptions.display` picks block math (default
  inline). It never throws. When `ok` is `false`, the root holds the TeX
  source as one `mtext`, so a failed formula still shows what the author
  wrote, and `issues` has one `MathIssue` (`code`, `message` and the UTF-16
  `offset` in the source).
- `mathText(node)` is the plain text of a tree.
- A `MathNode` has a `tag` (`MathTag`), optional `attrs` (keys of type
  `MathAttribute`, values from the converter's own tables), and either
  `text` (token elements `mi`, `mn`, `mo`, `mtext`) or `children`.

## Allowlists

`MATH_TAGS`, the only elements the converter emits: `math`, `mrow`, `mi`,
`mn`, `mo`, `mtext`, `mspace`, `msup`, `msub`, `msubsup`, `mfrac`, `msqrt`,
`mroot`, `mover`, `munder`, `munderover`, `mtable`, `mtr`, `mtd`, `mstyle`.

`MATH_ATTRIBUTES`, the only attributes it sets: `display`, `alttext`,
`mathvariant`, `stretchy`, `fence`, `separator`, `largeop`, `movablelimits`,
`accent`, `accentunder`, `linethickness`, `width`, `columnalign`,
`displaystyle`, `scriptlevel`, `form`, `lspace`, `rspace`.

A renderer should still create elements only from these lists (the
`@texuli/slides` stage does).

## The supported subset

| Area | Supported |
| --- | --- |
| Tokens | Letters (`mi`), numbers (`mn`, decimals included), operators `+ - * = < > / ! ( ) [ ] \| , ; : . ? @` (`-` becomes a minus sign) |
| Scripts | `x^2`, `x_i`, `x_i^2`, with braces for groups |
| Fractions | `\frac`, `\dfrac`, `\tfrac`, `\cfrac`, `\binom`, `\dbinom`, `\tbinom` |
| Roots | `\sqrt{x}`, `\sqrt[n]{x}` |
| Greek | `\alpha` … `\omega`, the `\var…` forms, uppercase `\Gamma` … `\Omega` (upright, as in TeX) |
| Symbols | `\infty`, `\partial`, `\nabla`, `\ell`, `\hbar`, `\emptyset`, `\varnothing`, `\aleph`, `\Re`, `\Im`, `\degree` |
| Relations and operators | `\le`, `\ge`, `\ne`, `\approx`, `\equiv`, `\sim`, `\simeq`, `\cong`, `\propto`, `\in`, `\notin`, `\ni`, `\subset`, `\subseteq`, `\supset`, `\supseteq`, `\cup`, `\cap`, `\setminus`, `\times`, `\cdot`, `\div`, `\pm`, `\mp`, `\circ`, `\oplus`, `\otimes`, arrows (`\to`, `\Rightarrow`, `\iff`, `\mapsto`…), logic (`\forall`, `\exists`, `\neg`, `\land`, `\lor`), dots (`\ldots`, `\cdots`, `\vdots`, `\ddots`) and more; `\not` before `=`, `<`, `>`, `\in`, `\subset`, `\equiv`… |
| Big operators | `\sum`, `\prod`, `\coprod`, `\bigcup`, `\bigcap`, `\bigoplus`, `\bigotimes` (limits under and over in display math), `\int`, `\iint`, `\iiint`, `\oint` (scripts kept) |
| Functions | `\sin`, `\cos`, `\tan`, `\log`, `\ln`, `\exp`… upright; `\lim`, `\max`, `\min`, `\sup`, `\inf`, `\det`, `\gcd`, `\Pr` take limits in display; `\operatorname{name}` (letters only) |
| Accents | `\hat`, `\widehat`, `\bar`, `\vec`, `\dot`, `\ddot`, `\tilde`, `\widetilde`, `\acute`, `\grave`, `\check`, `\breve`, `\overline`, `\overrightarrow`, `\overleftarrow`, `\overbrace`; under: `\underline`, `\underbrace` |
| Fonts | `\mathrm`, `\mathup`, `\mathbf`, `\mathit`, `\mathbb`, `\mathcal`, `\mathscr`, `\mathfrak`, `\mathsf`, `\mathtt`, `\boldsymbol` |
| Text | `\text`, `\textrm`, `\textnormal`, `\mbox`, `\textup`, `\textbf`, `\textit`, `\textsf`, `\texttt` |
| Delimiters | `\left … \right` with `( ) [ ] \| / .`, `\{ \}`, `\|`, `\langle \rangle`, `\lfloor \rfloor`, `\lceil \rceil`, `\vert`, `\Vert`; `\big`, `\Big`, `\bigg`, `\Bigg` and their `l`/`r` forms read as the plain delimiter |
| Spacing | `\,`, `\:`, `\>`, `\;`, `\ ` (backslash space), `\!`, `\quad`, `\qquad`, `\thinspace`, `\medspace`, `\thickspace`, `\enspace` |
| Escapes | `\{`, `\}`, `\%`, `\$`, `\&`, `\#`, `\_` |
| Environments | `matrix`, `smallmatrix`, `pmatrix`, `bmatrix`, `Bmatrix`, `vmatrix`, `Vmatrix`, `cases`, `aligned`, `align`, `gathered`, `array` (its column spec is read for alignment only), with `&` and `\\` |
| Ignored | `\limits`, `\nolimits`, `\displaystyle`, `\textstyle`, `\scriptstyle`, `\nonumber`, `\notag` |

```tex
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
\begin{pmatrix} 1 & 0 \\ 0 & 1 \end{pmatrix}
f(x) = \begin{cases} x & x \ge 0 \\ -x & x < 0 \end{cases}
```

## Refused by policy

Commands that would link, color, load, inject markup, label or define macros
are refused with `tex-unsupported`, and the whole formula falls back to its
source text: `\href`, `\url`, `\includegraphics`, `\color`, `\textcolor`,
`\colorbox`, `\fcolorbox`, `\htmlClass`, `\htmlId`, `\htmlStyle`,
`\htmlData`, `\html`, `\def`, `\gdef`, `\edef`, `\xdef`, `\let`,
`\newcommand`, `\renewcommand`, `\providecommand`, `\DeclareMathOperator`,
`\input`, `\include`, `\verb`, `\tag`, `\label`, `\ref`, `\eqref`, `\style`,
`\class` and `\cssId`. Any other command outside the subset is also
`tex-unsupported`.

## Codes and limits

`MATH_CODES` (type `MathCode`):

| Code | Meaning |
| --- | --- |
| `tex-unsupported` | A command or environment outside the subset, or refused by policy. |
| `tex-syntax` | Unbalanced braces, a missing argument, a double script, `\left` without `\right`… |
| `tex-limit` | Over a size, nesting or node bound. |

`MATH_LIMITS`, per formula, so hostile input stays cheap:

| Limit | Value |
| --- | --- |
| `source` | 2,000 UTF-16 units of TeX |
| `depth` | 16 nested groups, environments and fractions |
| `nodes` | 2,000 output nodes |
| `rows` | 50 rows per environment |
| `cells` | 400 cells per environment |

The Markdown dialect reports `tex-limit` as `md-tex-limit` and the other two
as `md-tex-unsupported`, located at the formula's line.
