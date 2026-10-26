// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { agentProblem, isAgentRequest } from '../src/lib/agent-request.ts';

describe('isAgentRequest', () => {
  it.each([
    ['GPTBot/1.0 (+https://openai.com/gptbot)'],
    ['Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'],
    ['Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'],
    ['Mozilla/5.0 (compatible; OAI-SearchBot/1.0)'],
    ['Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)'],
    ['Anthropic AI Client (anthropic-ai/1.0)'],
    ['curl/8.4.0'],
    ['Wget/1.21.3'],
    ['python-requests/2.31.0'],
    ['Go-http-client/2.0'],
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  ])('classifies %j as an agent', (userAgent) => {
    expect(isAgentRequest(userAgent)).toBe(true);
  });

  it.each([
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0'],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    ],
    // Audit tools need browser-shaped output, never problem+json.
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Chrome-Lighthouse',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36 Chrome-Lighthouse'],
  ])('classifies %j as human', (userAgent) => {
    expect(isAgentRequest(userAgent)).toBe(false);
  });

  it('treats a missing user agent as human', () => {
    expect(isAgentRequest(null)).toBe(false);
    expect(isAgentRequest(undefined)).toBe(false);
    expect(isAgentRequest('')).toBe(false);
  });
});

describe('agentProblem', () => {
  it('describes the miss honestly and points at the site guide', () => {
    expect(agentProblem('/no/such/page/', 'https://texuli.com')).toEqual({
      type: 'about:blank',
      title: 'Not found',
      status: 404,
      instance: '/no/such/page/',
      guide: 'https://texuli.com/llms.txt',
    });
  });
});
