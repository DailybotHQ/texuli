/** What a host returns for a media `ref`: a source the URL policy checks (`untrusted` tier), and its alt text. */
export type EditorMediaResolver = (ref: string) => { src: string; alt?: string } | null | undefined;
