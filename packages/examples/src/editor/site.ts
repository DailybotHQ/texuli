/**
 * `@texuli/examples/editor`: the editor parts texuli.com islands use, re-exported
 * from their own `@texuli/editor` subpaths (not the barrel, which is not lazy).
 * Interim: the website reaches the editor through this package until it declares
 * `@texuli/editor` itself, which needs an owner `pnpm install`. Then the site
 * imports `@texuli/editor/editor` directly and this file goes away.
 */
export { RichTextEditor } from '@texuli/editor/editor';
