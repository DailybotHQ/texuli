/**
 * The local dev server: the same handler under node:http, the fake replay
 * provider by default. `pnpm --filter @texuli/agent dev`
 * Env: AGENT_PORT (8787), AGENT_ENABLED ("0" turns it off),
 * AGENT_ALLOWED_ORIGIN (http://localhost:4321), AGENT_TOKEN_BUDGETS (JSON
 * ceilings), AGENT_LOCAL_CONFIG (the operator file, default
 * ~/.config/texuli/agent.json).
 *
 * Kill switch: `{ "enabled": false }` in the operator file hard-stops the
 * running server within a second, whatever AGENT_ENABLED says. A missing or
 * malformed file counts as no setting.
 *
 * Provider key (docs/key-store.md): AGENT_PROVIDER_KEY / AGENT_PROVIDER, or a
 * `provider` block in the operator file. It is wrapped as a redacting secret,
 * only its presence is printed, and no adapter uses it yet: the replay
 * provider answers. It never loads environment files from disk.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { loadCatalog } from './catalog.ts';
import { createCspReportStore } from './csp-reports.ts';
import { DEMO_RECORDINGS } from './demo.ts';
import { handleRequest } from './http.ts';
import { describeProviderKey } from './keys.ts';
import { createNodeAgentSettings } from './node-config.ts';
import { createReplayProvider } from './provider.ts';
import { createAgentService } from './service.ts';

const localConfigPath =
  process.env.AGENT_LOCAL_CONFIG ?? join(homedir(), '.config', 'texuli', 'agent.json');
// The operator file is read here and only here; a missing file means no setting.
const settings = createNodeAgentSettings({
  env: process.env,
  readConfigText: () => {
    try {
      return readFileSync(localConfigPath, 'utf8');
    } catch {
      return null;
    }
  },
});

const build = await loadCatalog();
const service = createAgentService({
  catalog: build.catalog,
  catalogHash: build.hash,
  provider: createReplayProvider(DEMO_RECORDINGS),
  killSwitch: settings.killSwitch,
  tokenBudgets: settings.tokenBudgets(),
});
// CSP reports from a locally built site, counted in memory for this process.
const cspReports = createCspReportStore();
const port = Number(process.env.AGENT_PORT ?? 8787);
const allowedOrigin = process.env.AGENT_ALLOWED_ORIGIN ?? 'http://localhost:4321';

createServer(async (req, res) => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(name, value);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const request = new Request(`http://localhost:${port}${req.url ?? '/'}`, {
    method: req.method,
    headers,
    ...(hasBody ? { body: Readable.toWeb(req) as ReadableStream, duplex: 'half' } : {}),
  } as RequestInit);
  const response = await handleRequest(request, {
    service,
    allowedOrigin,
    cspReports,
    ipOf: () => req.socket.remoteAddress ?? 'unknown',
  });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) {
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>)
      res.write(chunk);
  }
  res.end();
}).listen(port, () => {
  console.log(`agent: http://localhost:${port}/v1/health (catalog ${build.hash.slice(0, 12)})`);
  console.log(`agent: ${describeProviderKey(settings.providerKey())}`);
});
