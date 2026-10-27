/** Types for the plain-node SEO audit script (imported by its unit tests). */

export interface SeoFinding {
  severity: 'critical' | 'warning' | 'planned';
  category: string;
  page: string;
  detail: string;
}

export interface SeoPageInput {
  path: string;
  html: string;
  noindex: boolean;
}

export interface SeoAuditInput {
  pages: SeoPageInput[];
  sitemap: string | null;
  robots: string | null;
  readAsset?: (relativePath: string) => Buffer | null;
}

export interface SeoAuditConfig {
  site: string;
  og: { width: number; height: number; type: string };
  title: { min: number; max: number };
  description: { min: number; max: number };
  docsFamilies: string[];
  planned: { category: string; detail: string }[];
}

export interface SeoAuditResult {
  summary: {
    pages: { total: number; indexed: number; noindex: number };
    findings: { critical: number; warning: number; planned: number };
    byCategory: Record<string, { critical: number; warning: number; planned: number }>;
  };
  findings: SeoFinding[];
}

export interface SeoCollectedDist {
  pages: SeoPageInput[];
  redirects: number;
  sitemap: string | null;
  robots: string | null;
  readAsset: (relativePath: string) => Buffer | null;
}

export declare const AUDIT_CONFIG: SeoAuditConfig;
export declare function normalizePagePath(pathname: string, base?: string): string;
export declare function ogImageFile(pagePath: string): string;
export declare function metaContent(html: string, key: string): string | null;
export declare function canonicalOf(html: string): string | null;
export declare function jsonLdBlocks(html: string): string[];
export declare function isNoindex(html: string): boolean;
export declare function isRedirectPage(html: string): boolean;
export declare function pngSize(buffer: Buffer | null): { width: number; height: number } | null;
export declare function auditPage(page: SeoPageInput, config?: SeoAuditConfig): SeoFinding[];
export declare function auditSite(input: SeoAuditInput, config?: SeoAuditConfig): SeoAuditResult;
export declare function collectDist(distDir: string): SeoCollectedDist;
export declare function renderMarkdown(result: SeoAuditResult, config?: SeoAuditConfig): string;
