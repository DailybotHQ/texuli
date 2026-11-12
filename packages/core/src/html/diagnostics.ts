/** A bounded diagnostics list shared by the HTML reader and the Markdown → HTML writer. */
import type { MarkdownDiagnostic, MarkdownDiagnosticCode, MdPosition } from '../markdown/ast.ts';

/** Diagnostics kept per code; the rest are counted in one closing diagnostic per code. */
export const MAX_DIAGNOSTICS_PER_CODE = 64;

export class DiagnosticList {
  private readonly list: MarkdownDiagnostic[] = [];
  private readonly counts = new Map<MarkdownDiagnosticCode, number>();

  add(code: MarkdownDiagnosticCode, message: string, position?: MdPosition): void {
    const count = (this.counts.get(code) ?? 0) + 1;
    this.counts.set(code, count);
    if (count > MAX_DIAGNOSTICS_PER_CODE) return;
    this.list.push(position ? { code, message, position } : { code, message });
  }

  /** Whether a diagnostic with `code` was added. */
  has(code: MarkdownDiagnosticCode): boolean {
    return this.counts.has(code);
  }

  finish(): MarkdownDiagnostic[] {
    const out = [...this.list];
    for (const [code, count] of this.counts) {
      if (count > MAX_DIAGNOSTICS_PER_CODE)
        out.push({
          code,
          message: `${count - MAX_DIAGNOSTICS_PER_CODE} more ${code} diagnostics not listed.`,
        });
    }
    return out;
  }
}
