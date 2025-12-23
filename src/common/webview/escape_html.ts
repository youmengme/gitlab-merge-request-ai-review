// copied from https://gitlab.com/gitlab-org/gitlab-web-ide/blob/9bae1635461caedc5d2730248d0c4408509f16a0/packages/utils-escape/src/escapeHtml.ts
/**
 * Ported from mustache: https://github.com/janl/mustache.js/blob/v4.2.0/mustache.js#L60-L75
 * @license https://github.com/janl/mustache.js/blob/v4.2.0/LICENSE
 */
const entityMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

export const escapeHtml = (string: string) =>
  String(string).replace(/[&<>"'`=/]/g, s => entityMap[s]);
