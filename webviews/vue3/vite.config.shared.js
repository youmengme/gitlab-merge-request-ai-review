import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';

export default function buildConfigForWebview(name) {
  return {
    plugins: [
      vue({
        template: {
          compilerOptions: {
            compatConfig: {
              MODE: 2,
            },
          },
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        vue: '@vue/compat',
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
