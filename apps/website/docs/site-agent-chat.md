# texuli.com: agent chat

**App:** `apps/website`  
**Page:** `/agent-chat/`  
**Components:** `src/components/agent-chat/`  
**Tests:** `tests/e2e/site-agent-chat.spec.ts`, `apps/agent/tests/island.test.ts`,
`apps/agent/tests/site-chat.test.ts`

## Status

**Not deployed.** texuli.com does not run the agent service, and a production
build sets no endpoint. The page says so: the island shows the "not running"
notice and a deployment line, disables every input, and sends nothing (the
site spec checks that no request leaves the origin).

In local development the island can talk to the agent service running on
the developer's machine. That service answers with recorded replies (the
replay provider): there is no model, no key and no network call
(`apps/agent/docs/key-store.md`).

## Running it locally

```bash
pnpm --filter @texuli/agent dev
PUBLIC_TEXULI_AGENT_URL=http://localhost:8787 pnpm dev
```

The first command serves the agent on `http://localhost:8787` and allows the
Astro dev origin `http://localhost:4321` (`AGENT_ALLOWED_ORIGIN`). The second
builds the page with that endpoint; `agentEndpoint` accepts only `https:` or
`http://localhost` and `http://127.0.0.1`. The three preset prompts have
recorded replies.

## What the island shows

| Area | Content |
| --- | --- |
| Deployment line | "Not deployed" with the local setup, or the connected endpoint plus a note that texuli.com does not host the agent |
| Request steps | The steps the service streams over server-sent events, in order: accepted, writing, validating (one per attempt), repairing with the diagnostic codes, then validated or rejected. Each has a done, in-progress or failed state, and the latest is announced in a polite live region. |
| Draft lifecycle | Five stages: Requested, Drafted, Validated (by the service, with a receipt), Re-checked here (the player validates again in the untrusted tier before painting), Draft, not activated. It never goes further: activation belongs to the owner's own tool. A rejected draft stops at Validated, and a failed request stops at Drafted. |
| Preview | The player paints a valid draft; the receipt shows the model label, envelope status, attempts, time and checks. A rejected draft shows its validation codes instead of a preview. |

`src/components/agent-chat/lifecycle.ts` holds the step and lifecycle logic
(framework-free). Everything the service returns stays untrusted: text is
plain text, and the envelope status is read only if it is a short lowercase
word.

## Content security policy

The page's CSP keeps `connect-src 'self'` in production. When a build sets
`PUBLIC_TEXULI_AGENT_URL`, `agentConnectSources` (in
`src/components/security/csp.ts`) adds that endpoint's origin to
`connect-src` for `/agent-chat/` only, so a built page can reach the
configured service and no other page gains a connection. `pnpm --filter
@texuli/website check:csp` checks every page's hashes after a build.

## Validation

```bash
pnpm build
TEXULI_E2E_PORT=4943 pnpm exec playwright test tests/e2e/site-agent-chat.spec.ts
pnpm --filter @texuli/website check:csp
pnpm --filter @texuli/agent exec vitest run tests/site-chat.test.ts tests/island.test.ts
```

The connected flow (streamed steps, a repair, a rejection, the full
lifecycle) is covered in-process by `apps/agent/tests/site-chat.test.ts`: the
island's fetch goes straight to the agent's HTTP handler, so no server,
network or key is involved. A browser test of the connected flow against a
running dev service is **planned**.
