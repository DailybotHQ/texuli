/** Copy one displayed quickstart sample and report the result accessibly. */
export async function copyQuickstartSample(
  text: string,
  writeText: (value: string) => Promise<void>,
  report: (message: string) => void
): Promise<void> {
  try {
    await writeText(text);
    report('Code copied.');
  } catch {
    report('Copy failed: your browser blocked the clipboard.');
  }
}
