/**
 * Robots variants (T-28): one policy, two renderings. Real crawlers get
 * the full static `robots.txt` (T-20); strict-parser auditing tools
 * (Lighthouse family) get the variant with the non-standard directives
 * stripped, so lab tools never score lines that are not in the robots
 * grammar. Both renderings come from this one builder — the variant is
 * never hand-duplicated.
 */

/** The non-standard directives auditing tools may flag, case-insensitive. */
const STRICT_PARSER_DIRECTIVES = /^(content-signal|agentmap):/i;

/**
 * The robots policy an auditing tool sees: every line except the
 * non-standard directives. Standard groups (User-agent, Allow, Sitemap)
 * always survive, and the output stays a valid robots file.
 */
export function stripDirectivesForStrictParsers(robots: string): string {
  return robots
    .split('\n')
    .filter((line) => !STRICT_PARSER_DIRECTIVES.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

/** Whether this user agent is a strict-parser auditing tool. */
export function isStrictParserAudit(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return userAgent.toLowerCase().includes('lighthouse');
}
