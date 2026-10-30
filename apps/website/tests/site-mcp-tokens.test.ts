/**
 * /mcp-server/ and /tokens/ (PLAN_011 T-site-090): the page models render
 * the registries, not hand-copied lists. The local host snippets equal the
 * `@texuli/mcp` README (their written source), every tool lands in exactly
 * one group, the token counts are the registry's, both pages are docs-shell
 * routes in the nav and the search index, and no page writes an HTML sink.
 * The built pages are checked in tests/e2e/site-mcp.spec.ts and
 * tests/e2e/site-tokens.spec.ts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMPONENT_TOKEN_FAMILIES, COMPONENT_TOKENS } from '@texuli/tokens/components';
import { SYSTEM_TOKEN_FAMILIES, SYSTEM_TOKENS } from '@texuli/tokens/system';
import { DESIGN_DEFAULTS_VOCABULARY } from 'texuli/defaults';
import { describe, expect, it } from 'vitest';
import { DOC_SHELL_ROUTES } from '../src/components/foundation/nav-data.ts';
import { NAV_GROUPS } from '../src/components/foundation/site.ts';
import { MCP_SERVER_DATA } from '../src/components/mcp-server/mcp-server-data.ts';
import {
  COUNTS,
  CURL_TOOLS_LIST,
  doorsOf,
  limitsOf,
  MCP_HOSTS,
  TOOL_GROUPS,
  toolsIn,
  WEBMCP_TOOLS,
} from '../src/components/mcp-server/page.ts';
import { SEARCH_INDEX } from '../src/components/search/index-data.ts';
import {
  componentPageFor,
  DEFAULTS_ROWS,
  exportOf,
  familiesByPackage,
  TOKEN_COUNTS,
} from '../src/components/tokens-page/tokens.ts';

const README = readFileSync(resolve('packages/mcp/README.md'), 'utf8');
const page = (path: string) => readFileSync(resolve('apps/website/src/pages', path), 'utf8');
const PAGES = ['mcp-server/index.astro', 'tokens/index.astro', 'tokens/components/index.astro'];

describe('/mcp-server/ model', () => {
  it('offers every host both doors; the local snippets equal the @texuli/mcp README', () => {
    expect(MCP_HOSTS.map((host) => host.id)).toEqual([
      'claude-code',
      'cursor',
      'vscode',
      'windsurf',
      'codex',
      'generic',
    ]);
    for (const host of MCP_HOSTS) {
      expect(host.local, host.id).toContain('@texuli/mcp');
      expect(host.remote, host.id).toContain(MCP_SERVER_DATA.remote.url);
      if (host.id !== 'generic') expect(README, host.id).toContain(host.local);
    }
    // The JSON snippets parse.
    for (const host of MCP_HOSTS.filter((entry) => entry.language === 'json')) {
      expect(() => JSON.parse(host.local), host.id).not.toThrow();
      expect(() => JSON.parse(host.remote), host.id).not.toThrow();
    }
  });

  it('groups every registry tool exactly once, with its doors and limits', () => {
    const grouped = TOOL_GROUPS.flatMap((group) => toolsIn(group.runtime).map((tool) => tool.name));
    expect(grouped.sort()).toEqual(MCP_SERVER_DATA.tools.map((tool) => tool.name).sort());
    expect(COUNTS.tools).toBe(MCP_SERVER_DATA.tools.length);
    for (const tool of toolsIn('site')) expect(doorsOf(tool)).toBe('Remote only');
    for (const tool of toolsIn('node')) expect(doorsOf(tool)).toBe('Local only');
    for (const tool of toolsIn('edge')) expect(doorsOf(tool)).toBe('Remote and local');
    expect(limitsOf(toolsIn('edge')[0] as (typeof MCP_SERVER_DATA.tools)[number])).toMatch(
      /^input \d+ KiB/
    );
    expect(WEBMCP_TOOLS.length).toBeGreaterThan(0);
    expect(CURL_TOOLS_LIST).toContain('"method":"tools/list"');
    expect(CURL_TOOLS_LIST).toContain(MCP_SERVER_DATA.protocolVersion);
  });
});

describe('/tokens/ model', () => {
  it('counts what the registries hold', () => {
    expect(TOKEN_COUNTS.system).toBe(SYSTEM_TOKENS.length);
    expect(TOKEN_COUNTS.systemFamilies).toBe(SYSTEM_TOKEN_FAMILIES.length);
    expect(TOKEN_COUNTS.component).toBe(COMPONENT_TOKENS.length);
    expect(TOKEN_COUNTS.components).toBe(COMPONENT_TOKEN_FAMILIES.length);
    expect(DEFAULTS_ROWS).toHaveLength(Object.keys(DESIGN_DEFAULTS_VOCABULARY).length);
    const grouped = familiesByPackage().flatMap((group) => group.families);
    expect(grouped).toHaveLength(COMPONENT_TOKEN_FAMILIES.length);
    expect(exportOf({ package: 'texuli', subpath: 'alert' })).toBe('texuli/alert');
    expect(exportOf({ package: '@texuli/chat', subpath: '.' })).toBe('@texuli/chat');
    expect(componentPageFor('button')).toBe('/component-pages/button/');
    expect(componentPageFor('no-such-component')).toBeUndefined();
  });
});

describe('the pages', () => {
  it('are docs-shell routes in the nav and the search index', () => {
    const links = NAV_GROUPS.flatMap((group) => group.links.map((link) => link.href));
    const searched = SEARCH_INDEX.map((entry) => entry.href);
    for (const route of ['/mcp-server/', '/tokens/', '/tokens/components/']) {
      expect(links, route).toContain(route);
      expect(DOC_SHELL_ROUTES, route).toContain(route);
      expect(searched, route).toContain(route);
    }
  });

  it('render data as text: no HTML sink, one h1, no island', () => {
    for (const path of PAGES) {
      const source = page(path);
      expect(source, path).not.toMatch(/\{@html|set:html|innerHTML|client:/);
      expect((source.match(/<h1[\s>]/g) ?? []).length, path).toBe(1);
      expect(source, path).not.toMatch(/production[- ]ready|is released|available on npm/i);
    }
  });
});
