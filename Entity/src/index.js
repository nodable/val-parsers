/**
 * @nodable/entities
 *
 * Standalone, zero-dependency XML/HTML entity replacement.
 *
 * @example
 * import EntityReplacer, { COMMON_HTML, CURRENCY_ENTITIES } from '@nodable/entities';
 *
 * const replacer = new EntityReplacer({
 *   default: true,
 *   system: { ...COMMON_HTML, ...CURRENCY_ENTITIES },
 * });
 *
 * replacer.replace('Price: &pound;9.99 &mdash; &copy; 2024');
 * // → 'Price: £9.99 — © 2024'
 */

export { default } from './EntityReplacer.js';
export { DEFAULT_XML_ENTITIES, AMP_ENTITY } from './EntityReplacer.js';
export {
  COMMON_HTML,
  CURRENCY_ENTITIES,
  MATH_ENTITIES,
  ARROW_ENTITIES,
  NUMERIC_ENTITIES,
} from './groups.js';