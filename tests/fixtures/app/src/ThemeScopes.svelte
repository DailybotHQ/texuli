<script lang="ts">
import type { Theme } from '@texuli/tokens';
import ScopePanel, { type ScopeApi } from './ScopePanel.svelte';

/* tests/e2e/theme-scopes.spec.ts drives the panels through `window.txScopes`. */
type Scope = { theme: Theme; mode: 'light' | 'dark' };
let { scopes }: { scopes: { a: Scope; b: Scope } } = $props();

const apis: Record<string, ScopeApi> = {};
function register(id: string, api: ScopeApi): void {
  apis[id] = api;
}
if (typeof window !== 'undefined') Object.assign(window, { txScopes: apis });
</script>

<div class="scopes">
  <ScopePanel id="a" label="Clinic" theme={scopes.a.theme} mode={scopes.a.mode} {register} />
  <ScopePanel id="b" label="Arcade" theme={scopes.b.theme} mode={scopes.b.mode} {register} />
</div>

<style>
  .scopes {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
</style>
