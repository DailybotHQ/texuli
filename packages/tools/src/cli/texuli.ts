#!/usr/bin/env node
/// <reference types="node" />
/**
 * The `texuli` bin: `texuli <group> <verb>` for every operation of the
 * registry plus the commands kept from 0.8 (see `router.ts`).
 */
import { isMainModule } from '../internal/is-main.ts';
import { type RouterResult, runRouter } from './router.ts';

export async function runTexuliCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<RouterResult> {
  return runRouter(argv);
}

if (isMainModule(import.meta.url)) void runTexuliCli();
