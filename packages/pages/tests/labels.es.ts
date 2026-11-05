import type { BlocksMessageId } from '@texuli/blocks/i18n';
import type { LabelDictionary } from '@texuli/core/i18n';
import type { TexuliLabels } from 'texuli';
import type { PagesMessageId } from '../src/index.ts';

/**
 * A Spanish dictionary for the representative set (ADR-026): what a host
 * such as Corag passes once. Fictional product copy; not a shipped
 * translation.
 */
export const ES: TexuliLabels & LabelDictionary<BlocksMessageId | PagesMessageId> = {
  'texuli.breadcrumb.label': 'Ruta de navegación',
  'texuli.breadcrumb.separator-label': 'Separador',
  'texuli.toaster.label': 'Notificaciones',
  'texuli.toaster.dismiss-label': 'Descartar notificación',
  'texuli.timeline.label': 'Cronología',
  'texuli.timeline.complete': 'Completado',
  'texuli.timeline.current': 'En curso',
  'texuli.timeline.upcoming': 'Próximo',
  'texuli.kpi.empty': 'Aún no hay datos',
  'texuli.stat.increased': 'Subió',
  'texuli.stat.decreased': 'Bajó',
  'texuli.stat.no-change': 'Sin cambios',
  'primitives.pagination.label': 'Paginación',
  'primitives.pagination.previous-label': 'Página anterior',
  'primitives.pagination.next-label': 'Página siguiente',
  'primitives.pagination.page-label': 'Página {page}',
  'primitives.toast.toaster.label': 'Notificaciones',
  'blocks.text.tones.info': 'Información',
  'blocks.text.tones.warning': 'Advertencia',
  'blocks.interactive.checklist': 'Lista de verificación',
  'blocks.interactive.checklist-progress': 'Completadas',
  'blocks.diagram.board-summary': 'Tablero con {columns} y {cards}',
  'blocks.diagram.board-columns-other': '{count} columnas',
  'blocks.diagram.board-cards-one': '{count} tarjeta',
  'blocks.diagram.board-cards-other': '{count} tarjetas',
  'blocks.diagram.board-empty': 'Sin tarjetas',
  'blocks.diagram.terminal-summary-one': 'Sesión de terminal, {count} comando',
  'blocks.diagram.terminal-command': 'Comando:',
  'blocks.code.copy': 'Copiar',
  'blocks.code.copy-name': 'Copiar el código {name}',
  'pages.reader': 'Página',
  'pages.outline': 'En esta página',
  'pages.editor': 'Editor de páginas',
  'pages.insert-below': 'Insertar un bloque debajo',
  'pages.type-names.heading': 'Título',
  'pages.type-names.paragraph': 'Párrafo',
  'pages.handle': '{type}: {excerpt}',
};
