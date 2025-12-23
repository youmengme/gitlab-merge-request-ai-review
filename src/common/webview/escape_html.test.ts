// copied from https://gitlab.com/gitlab-org/gitlab-web-ide/blob/9bae1635461caedc5d2730248d0c4408509f16a0/packages/utils-escape/src/escapeHtml.test.ts
import { escapeHtml } from './escape_html';

describe('utils/escape/escapeHtml', () => {
  it('escapes common HTML control characters', () => {
    expect(escapeHtml(`<script>a = b & '"\`'</script>`)).toBe(
      `&lt;script&gt;a &#x3D; b &amp; &#39;&quot;&#x60;&#39;&lt;&#x2F;script&gt;`,
    );
  });
});
