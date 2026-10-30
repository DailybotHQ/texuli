import { describe, expect, it } from 'vitest';
import { blockingRows, scanRows } from '../agent-readiness.ts';

const scan = {
  url: 'https://release-0-9-0.texuli.pages.dev',
  level: 5,
  levelName: 'Agent-Native',
  checks: {
    discoverability: {
      robotsTxt: { status: 'pass', message: 'ok' },
      dnsAid: { status: 'fail', message: 'DNSSEC was not validated' },
    },
    botAccessControl: { webBotAuth: { status: 'neutral', message: 'informational only' } },
    discovery: {
      authMd: { status: 'fail', message: 'agent_auth metadata was not found' },
      webMcp: { status: 'pass', message: '4 tools' },
    },
    commerce: { x402: { status: 'neutral', message: 'not a commerce site' } },
  },
};

describe('agent readiness scan evaluation', () => {
  it('flattens every check and marks the allowed ones', () => {
    const rows = scanRows(scan, new Set(['authMd']));
    expect(rows).toHaveLength(6);
    expect(rows.find((row) => row.check === 'authMd')?.allowed).toBe(true);
    expect(rows.find((row) => row.check === 'dnsAid')?.allowed).toBe(false);
  });

  it('blocks on failing non-commerce checks only, never on neutral or allowed ones', () => {
    expect(blockingRows(scanRows(scan, new Set())).map((row) => row.check)).toEqual([
      'dnsAid',
      'authMd',
    ]);
    expect(blockingRows(scanRows(scan, new Set(['dnsAid', 'authMd'])))).toEqual([]);
  });

  it('never requires commerce checks, even when they fail', () => {
    const failingCommerce = {
      checks: { commerce: { x402: { status: 'fail', message: 'no payment protocol' } } },
    };
    expect(blockingRows(scanRows(failingCommerce, new Set()))).toEqual([]);
  });
});
