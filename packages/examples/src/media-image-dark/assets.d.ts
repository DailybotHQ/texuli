// Vite serves these as files (never inlined as data: URLs, which the
// untrusted image policy rejects). Declared here because the examples
// tsconfig does not load `vite/client`.
declare module '*.svg?url&no-inline' {
  const src: string;
  export default src;
}
