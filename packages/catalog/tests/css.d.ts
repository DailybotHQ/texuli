// The content-manifest type proof (`manifests-content.types.svelte`) reaches
// renderer sources that import stylesheets (`texuli/icons` imports
// `icons.css`), as the player, slides and blocks packages declare too.
declare module '*.css';
