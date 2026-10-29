# Agent service: provider key store and local dev boundary

**Status: design plus the code that holds a key safely. No key exists and no
provider account exists.** Real provider adapters exist as library code
([providers.md](providers.md)); they take the key as a constructor option and
read nothing themselves, and nothing in the repository constructs one. The
service answers with the deterministic replay provider (`src/provider.ts`). Choosing a
provider, creating an account, placing a key and deploying are developer
decisions (agent-service design §7 and §12).

## Rules

1. **Never in the repository.** No key in source, tests, fixtures, docs,
   examples, packed tarballs or CI configuration. `tests/keys.test.ts` scans
   `src/`, `tests/`, `docs/` and the README for provider-shaped keys on every
   run.
2. **Never in logs or responses.** A key is wrapped as a `Secret`
   (`src/keys.ts`) the moment it is read. `String()`, template literals,
   `JSON.stringify`, `util.inspect` and `console.log` print `[redacted]`. Only
   `reveal()` returns the value, for the provider call that needs it.
   `redactSecrets(text, keys)` scrubs upstream error text before it is logged
   or returned. Health, receipts and draft responses carry no key; the tests
   send a fictional key through the edge worker and check both responses.
3. **Read only at run time, only by an adapter.** `src/keys.ts`,
   `src/guard.ts` and `src/node-config.ts` read no files and no environment.
   The adapters pass in what they read:

   | Adapter | Reads | Never reads |
   | --- | --- | --- |
   | Node dev server (`src/node.ts`) | `AGENT_PROVIDER_KEY` and `AGENT_PROVIDER` from the shell; the operator file `~/.config/texuli/agent.json` (path override: `AGENT_LOCAL_CONFIG`) | `.env` files, the repository, any other path |
   | Edge worker (`src/worker.ts`) | `AGENT_PROVIDER_KEY` and `AGENT_PROVIDER` from the platform's secret store, via its `env` | Any file |

The worker's independent `AGENT_SESSION_SECRET` signs anonymous session
tokens. The worker refuses session and draft routes if it is absent or shorter
than 32 UTF-8 bytes. Use a randomly generated value from the platform secret
store; this is separate from any provider key.

4. **Tests inject keys as config text or a fake environment**, never a file:
   `createNodeAgentSettings({ env, readConfigText })` takes a function that
   returns the operator file's text, and `workerProviderKey(env)` takes the
   worker's environment. Every key in the tests is fictional
   (`test-key-not-real-…`).

## The operator file

`~/.config/texuli/agent.json` lives in the developer's home directory, outside
the repository. It already drives the kill switch; the `provider` block is
optional:

```json
{
  "enabled": true,
  "provider": { "id": "<provider id>", "key": "<placed by the developer>" }
}
```

- `enabled` keeps its meaning: only `false` matters, and it stops the service
  whatever `AGENT_ENABLED` says. A `provider` block never turns the service on
  or off.
- `provider.id` is a short lowercase name (`^[a-z][a-z0-9-]{0,31}$`).
  `provider.key` is printable ASCII, no spaces, 8 to 512 characters. A
  malformed block is ignored as a whole; any other field (for example a stray
  `apiKey`) is ignored too.
- The file should be readable only by its owner (`chmod 600`). The service
  does not check file permissions.

## Resolution

`resolveProviderKey({ envKey, envProvider, local })`:

1. A well-formed `AGENT_PROVIDER_KEY` wins, so a hosted worker's secret store
   always decides.
2. Otherwise the operator file's `provider` block is used (Node dev only).
3. Otherwise there is no key and the replay provider answers.

Malformed settings are reported by **name** in `rejected` (for example
`AGENT_PROVIDER_KEY`), never by value. `describeProviderKey` is the only thing
the Node adapter prints at startup, for example
`provider key: present for <id> (local-config; no adapter uses it yet)`.

## The xAI and local-dev boundary

- The media-generation design names xAI as an authorized **concept** for
  site illustrations, with a planned key convention
  (`~/.config/texuli/xai.env`). That convention belongs to the media plan and
  is **not provisioned**. The agent service does not read it.
- The agent service has **no xAI account, no xAI key and no xAI adapter**.
  `xai` would only be a provider id in `AGENT_PROVIDER` or the operator file
  once a developer decides on it. No test, eval or CI job calls xAI or any
  other provider.
- Local development uses the replay provider by default. A key placed in the
  operator file today is resolved, wrapped and reported as present, and then
  **unused**: neither the Node adapter nor the worker passes it to an adapter.
  Wiring one in is a developer decision ([providers.md](providers.md#plugging-in-a-real-provider-a-developer-step)).

## Planned, not done

- Wiring an adapter into the Node dev server or the worker. The adapters
  (`src/providers/`) already call `key.reveal()` only while building the
  request headers, and their error messages carry no upstream text.
- Key rotation: the Node adapter re-reads the operator file each second today,
  but no adapter caches or refreshes provider sessions.
- A model eval script that reads the key at run time (agent-service design
  §9); it stays report-only and developer-run.

```bash
pnpm --filter @texuli/agent exec vitest run tests/keys.test.ts
```
