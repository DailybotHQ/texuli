/**
 * Agent-request classification (T-27): a pure user-agent read that decides
 * whether a miss should return RFC 9457 `application/problem+json` instead
 * of the HTML 404 page. Conservative by design: a known agent token, a
 * generic crawler marker, or a plain HTTP client classifies as an agent;
 * browsers and audit tools (Lighthouse, which needs browser-shaped output)
 * stay human.
 */

/** Tokens that identify agent and crawler clients, case-insensitive. */
const AGENT_TOKENS = [
  // The robots.txt AI-crawler list (seo.ts), lowercase.
  'gptbot',
  'chatgpt-user',
  'claudebot',
  'anthropic-ai',
  'google-extended',
  'bytespider',
  'ccbot',
  'perplexitybot',
  'applebot-extended',
  'amazonbot',
  'meta-externalagent',
  'cohere-ai',
  'oai-searchbot',
  'deepseekbot',
  'claude-searchbot',
  'perplexity-user',
  // Generic crawler markers.
  'bot/',
  'bot;',
  'crawler',
  'spider',
  'slurp',
  // Plain HTTP clients an agent shell would drive.
  'curl/',
  'wget/',
  'python-requests',
  'go-http-client',
];

/** Audit tools that need browser-shaped output and must stay human. */
const NON_AGENT_TOKENS = ['chrome-lighthouse', 'lighthouse'];

/**
 * Whether a request with this `User-Agent` is an automated consumer. A
 * missing header classifies as human: the site's pages stay for browsers.
 */
export function isAgentRequest(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  if (NON_AGENT_TOKENS.some((token) => ua.includes(token))) return false;
  return AGENT_TOKENS.some((token) => ua.includes(token));
}

/** The RFC 9457 body for an agent miss: honest status, the llms.txt pointer. */
export function agentProblem(pathname: string, origin: string): Record<string, unknown> {
  return {
    type: 'about:blank',
    title: 'Not found',
    status: 404,
    instance: pathname,
    guide: `${origin}/llms.txt`,
  };
}
