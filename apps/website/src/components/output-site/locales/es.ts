/**
 * A Spanish catalog written for the /output-page/ demo, as a host would
 * write its own: it covers only the labels of the components in the demo.
 * Texuli ships English only; translations beyond English are planned. It
 * is loaded lazily, the first time someone picks Spanish.
 */
import type { MessageCatalog } from '@texuli/core/i18n';

const catalog: MessageCatalog = {
  locale: 'es',
  messages: {
    'texuli.rating.label': 'Valoración',
    'texuli.rating.item': '{value} de {max} estrellas',
    'texuli.rating.summary': '{value} de {max}',
    'texuli.rating.none': 'Sin valorar',
    'texuli.rating.display': 'Valorado con {value} de {max}',
    'texuli.tags-input.input-label': 'Añadir una etiqueta',
    'texuli.tags-input.placeholder': 'Añadir…',
    'texuli.tag.remove-label': 'Quitar {label}',
    'texuli.copy-button.label': 'Copiar',
    'texuli.copy-button.copied-label': 'Copiado',
    'primitives.tags-input.added': '{0} añadida',
    'primitives.tags-input.remove': 'Quitar {0}',
    'primitives.tags-input.removed': '{0} quitada',
    'primitives.tags-input.duplicate': '{0} ya está añadida',
    'demo.files': {
      plural: 'count',
      '=0': 'Ningún archivo',
      one: '# archivo',
      other: '# archivos',
    },
  },
};

export default catalog;
