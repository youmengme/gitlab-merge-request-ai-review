import path from 'node:path';
import fs from 'node:fs';
import { writeFile } from 'node:fs/promises';
// eslint-disable-next-line import/no-unresolved
import { copy } from 'fs-extra/esm';
import * as glob from 'glob';
import { rimraf } from 'rimraf';
import { root, run } from './run_utils.mjs';
import { generateFont } from './generate_font.mjs';
import { prettyPrint } from './packages.mjs';

const prepareDistDirs = async env => {
  fs.mkdirSync(path.join(root, `dist-${env}`));
  fs.mkdirSync(path.join(root, `dist-${env}/webviews`));
  fs.mkdirSync(path.join(root, `dist-${env}/assets`));
};

const copyLanguageServerAssets = env => {
  const platformDirectory = env === 'desktop' ? 'node' : 'browser';
  const basePath = path.join(root, 'node_modules/@gitlab-org/gitlab-lsp/out');
  const platformAssets = glob.sync(
    [
      path.join(basePath, platformDirectory, '**', 'main-bundle*.*'),
      path.join(basePath, 'main-bundle-node.*'),
      path.join(basePath, '*.wasm'),
      path.join(basePath, '**', '*.wasm'),
      path.join(basePath, 'webviews', '**', '*.*'),
    ],
    {
      windowsPathsNoEscape: true,
    },
  );

  const copyPromises = platformAssets.map(asset =>
    copy(asset, path.join(`dist-${env}/assets/language-server`, asset.replace(basePath, ''))),
  );

  return Promise.all(copyPromises);
};

export const copyStaticProjectFiles = env => {
  const files = ['.vscodeignore', 'README.md', 'LICENSE', 'CHANGELOG.md'];
  files.forEach(file => {
    fs.copyFileSync(path.join(root, file), path.join(root, `dist-${env}/${file}`));
  });
};

export async function cleanBuild(env) {
  await rimraf(`dist-${env}`);
}

export async function prepareWebviews(webviews, env) {
  const targets = Object.keys(webviews);

  return Promise.all(
    targets.map(async target => {
      await run('npm', ['run', '--prefix', path.join(root, `webviews/${target}`), 'build']);
      webviews[target].forEach(async webview => {
        await copy(
          path.join(root, `webviews/${target}/dist/${webview}`),
          path.join(root, `dist-${env}/webviews/${webview}`),
        );
      });
    }),
  );
}

export async function generateAssets(packageJson, env) {
  return Promise.all([
    copy(path.join(root, 'src/assets'), path.join(root, `dist-${env}/assets`)),
    copyLanguageServerAssets(env),
    generateFont(packageJson, `dist-${env}`),
  ]);
}

export async function writePackageJson(packageJson, env) {
  await writeFile(path.join(root, `dist-${env}/package.json`), prettyPrint(packageJson));
}

export async function commonJobs(env) {
  await cleanBuild(env);
  await prepareDistDirs(env);
}
