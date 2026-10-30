/** Types for the plain-node agent-surface audit script (imported by its tests). */

export interface AeoFinding {
  severity: 'critical' | 'warning' | 'planned';
  category: string;
  page: string;
  detail: string;
}

export interface AeoConfig {
  site: string;
  assetPrefixes: string[];
  wellKnown: Record<string, string>;
  offSiteHosts: string[];
  twinFamilies: string[];
  robotsMinGroups: number;
  planned: { category: string; detail: string }[];
  /** The tool names the MCP server card must advertise (the operations registry). */
  mcpTools?: readonly string[];
}

export interface AeoSurface {
  distDir: string;
  llmsTxt: string | null;
  llmsComponents: string | null;
  llmsFull: string | null;
  wellKnown: Record<string, string | null>;
  mdManifest: string | null;
  robots: string | null;
  topRoutes: string[];
  familyPages: Record<string, string[]>;
  readBytes: (relative: string) => Buffer | null;
  exists?: (path: string) => boolean;
}

export interface AeoResult {
  summary: {
    surface: { topRoutes: number; twins: number; wellKnownFiles: number };
    findings: { critical: number; warning: number; planned: number };
    byCategory: Record<string, { critical: number; warning: number; planned: number }>;
  };
  findings: AeoFinding[];
}

export declare const AEO_CONFIG: AeoConfig;
export declare function distPathFor(url: string, config: AeoConfig): string | null;
export declare function onSitePathFor(url: string, config: AeoConfig): string | null;
export declare function distPathExists(distDir: string, path: string | null): boolean;
export declare function collectAeo(distDir: string, config?: AeoConfig): AeoSurface;
export declare function auditAeo(surface: AeoSurface, config?: AeoConfig): AeoResult;
export declare function renderMarkdown(result: AeoResult, config?: AeoConfig): string;
