/**
 * The sheet host for player tests, as a host wires it: the real adapter
 * from `@texuli/sheets/host` (`createSheetPlayerHost`), which validates the
 * sheet and mounts a read-only `SheetView`. The player itself never imports
 * the formula engine; only these tests reach it, by path.
 */
import { createSheetPlayerHost } from '../../sheets/src/host/index.ts';
import type { SheetPlayerHost } from '../src/sheet-host.ts';

export function testSheetHost(): SheetPlayerHost {
  return createSheetPlayerHost();
}
