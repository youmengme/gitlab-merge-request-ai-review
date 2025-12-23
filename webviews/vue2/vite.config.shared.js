import fs from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import * as NodeHtmlParser from 'node-html-parser';

import vue2 from '@vitejs/plugin-vue2';

let svgSpriteContent = '';

const imageToBase64 = imagePath => {
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
};

// This plugin removes `type="module"` and crossorigin from script tags.
//
// Using `type="module"` forces browsers to make a CORS request (see [relevant article][1]).
// Since VSCode webviews must live in a separate origin, this puts a
// burden on self-managed. Please see [relevant discussion][2].
//
// [1]: https://gitlab.com/gitlab-org/gitlab/-/issues/441105#note_1772250057
// [2]: https://jakearchibald.com/2021/cors/#making-a-cors-request
const SyncLoadScriptsPlugin = {
  name: 'sync-load-scripts-plugin',
  transformIndexHtml(html) {
    const doc = NodeHtmlParser.parse(html);
    const body = doc.querySelector('body');
    doc.querySelectorAll('head script').forEach(script => {
      script.removeAttribute('type');
      script.removeAttribute('crossorigin');

      body.appendChild(script);
    });

    return doc.toString();
  },
};

const HtmlTransformPlugin = {
  name: 'html-transform',
  transformIndexHtml(html) {
    return html.replace('{{ svg placeholder }}', svgSpriteContent);
  },
};

const InlineSvgPlugin = {
  name: 'inline-svg',
  transform(code, id) {
    if (id.endsWith('@gitlab/svgs/dist/icons.svg')) {
      svgSpriteContent = fs.readFileSync(id, 'utf-8');
      return 'export default ""';
    }
    if (id.match(/@gitlab\/svgs\/dist\/illustrations\/.*\.svg$/)) {
      const base64Data = imageToBase64(id);
      return `export default "data:image/svg+xml;base64,${base64Data}"`;
    }
    return code;
  },
};

export default function buildConfigForWebview(name) {
  return {
    plugins: [vue2(), InlineSvgPlugin, SyncLoadScriptsPlugin, HtmlTransformPlugin],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      // TODO: split the config into dev and prod versions and enable inline sourcemaps in the dev
      // you can set sourcemaps to 'inline' for webview debugging
      // sourcemap: 'inline',
      // Can be achieved by supplying the `isProd` argument to buildConfigForWebview
      sourcemap: false,
      rollupOptions: {
        input: `${name}/index.html`,
        output: {
          entryFileNames: `${name}/assets/app.js`,
          assetFileNames: `${name}/assets/[name].[ext]`,
        },
      },
      emptyOutDir: false,
    },
  };
}
