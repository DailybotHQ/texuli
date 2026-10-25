# Layer guard fixtures

Two tiny workspaces for `scripts/tests/layers.test.ts`. Every file carries a
`.fixture` suffix so Biome, TypeScript and pnpm never treat these deliberately
broken sources as part of the repository. The test copies a case into a temp
directory and drops the suffix before running the guard.

- `clean/` must produce no finding. It mentions the banned patterns only in
  comments and strings, and uses dynamic styles and `style:` directives.
- `violations/` has one or more instances of every rule at known lines.
