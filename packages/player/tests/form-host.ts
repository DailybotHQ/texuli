/**
 * The form host for player tests, as a host wires it: the real adapter
 * from `@texuli/forms/host` (`createFormPlayerHost`), which validates the
 * schema and mounts `SchemaForm`. The player itself never imports the form
 * engine; only these tests reach it, by path.
 */
import { checkFormDraft, createFormPlayerHost } from '../../forms/src/host/index.ts';
import type { DraftFormCheck, FormPlayerHost } from '../src/form-host.ts';

export const checkForm: DraftFormCheck = checkFormDraft;

export function testFormHost(): FormPlayerHost {
  return createFormPlayerHost();
}
