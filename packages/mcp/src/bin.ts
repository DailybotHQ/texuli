#!/usr/bin/env node
/// <reference types="node" />
import { runTexuliMcpCli } from './index.ts';

runTexuliMcpCli().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'The MCP server failed.'}\n`);
  process.exitCode = 1;
});
