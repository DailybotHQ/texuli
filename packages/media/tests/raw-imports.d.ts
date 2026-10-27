// Vite `?raw` imports: tests read component sources as text to pin CSS and
// markup contracts (the same declaration packages/chat keeps in src/css.d.ts).
declare module '*?raw' {
  const content: string;
  export default content;
}
