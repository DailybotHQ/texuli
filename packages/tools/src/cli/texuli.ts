#!/usr/bin/env node
/// <reference types="node" />
import { isMainModule } from '../internal/is-main.ts';
import { runDeckCli } from './deck.ts';

export async function runTexuliCli(argv: readonly string[] = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  if (command === 'deck') return runDeckCli(rest);
  const message = command ? `Unknown texuli command "${command}".` : 'Expected a texuli command.';
  process.stderr.write(`${message} Available: deck.\n`);
  process.exitCode = 1;
  return { ok: false, error: message };
}

if (isMainModule(import.meta.url)) void runTexuliCli();
