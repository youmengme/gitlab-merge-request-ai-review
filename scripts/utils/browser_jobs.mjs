import path from 'node:path';
import { copy } from 'fs-extra';
import { subscribe } from '@parcel/watcher';
import { ENVIRONMENTS } from '../constants.mjs';
import { root, run } from './run_utils.mjs';
import { createBrowserPackageJson } from './packages.mjs';
import {
  prepareWebviews,
  generateAssets,
  writePackageJson,
  commonJobs,
  copyStaticProjectFiles,
} from './common_jobs.mjs';

const browserWebviews = {
  vue3: [],
  vue2: ['gitlab_duo_chat', 'security_finding'],
};

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Copy files with a debounce to avoid rapid copy operations.
 * @param {*} srcPath copy source directory path
 * @param {*} destPath copy destination directory path
 * @param {*} watcherName name of the watcher for logging
 * @returns
 */
const debouncedCopy = (srcPath, destPath, watcherName) =>
  debounce(async () => {
    try {
      console.log(`[${watcherName}] copy to ${destPath} started`);
      await copy(srcPath, destPath, {
        recursive: true,
      });
      console.log(`[${watcherName}] copy to ${destPath} completed`);
    } catch (error) {
      console.log(`[${watcherName}] copy failed: ${error.message}`);
    }
  }, 500);

/**
 * Helper function to watch changes from source and copy to the destionation
 * @param { watchPath, watcherName, copyFn } watchDetails
 * @param {*} signal
 */
async function watchChanges(watchDetails, signal) {
  const { watchPath, watcherName, copyFn } = watchDetails;
  try {
    await subscribe(watchPath, async (err, events) => {
      if (signal.aborted) {
        return;
      }
      if (err) {
        console.log(err);
        return;
      }

      for (const event of events) {
        const { type, path: eventPath } = event;
        const relativePath = path.relative(root, eventPath);
        switch (type) {
          case 'create':
            console.log(`[${watcherName}] File ${relativePath} has been added`);
            break;
          case 'update':
            console.log(`[${watcherName}] File ${relativePath} has been changed`);
            break;
          case 'delete':
            console.log(`[${watcherName}] File ${relativePath} has been removed`);
            break;
          default:
            console.log(`[${watcherName}] File ${relativePath} has been ${type}`);
            break;
        }
      }

      copyFn();
    });
  } catch (err) {
    console.log(`[${watcherName}] failed to subscribe to changes: ${err.message}`);
  }
}

/**
 * Watch browser webviews changes, build and copy to the dist-browser/webviews
 * @param {*} signal
 */
export async function watchWebviews(signal) {
  console.log('watchWebviews started');

  const targets = Object.keys(browserWebviews);

  const npmWatchPromises = targets
    .filter(target => browserWebviews[target].length)
    .map(target =>
      run('npm', ['run', '--prefix', path.join(root, `webviews/${target}`), 'watch'], {
        cancelSignal: signal,
      }),
    );

  targets.forEach(async target => {
    browserWebviews[target].forEach(async webview => {
      const watchPath = path.resolve(root, `webviews/${target}/dist/${webview}`);
      const watcherName = 'watchWebviews';
      await watchChanges(
        {
          watchPath,
          watcherName,
          copyFn: debouncedCopy(watchPath, `dist-browser/webviews/${webview}`, watcherName),
        },
        signal,
      );
    });
  });

  // Wait for npm watch processes (indefinitely)
  await Promise.all(npmWatchPromises);
}

/**
 * Watch browser vscode extension changes, build and copy to the local gitlab-web-ide
 * @param {*} signal
 */
export async function watchBuild(webIdePath, signal) {
  console.log('watchBuild started');
  const watchPath = path.resolve(root, 'dist-browser/');
  const watcherName = 'watchBuild';

  await watchChanges(
    {
      watchPath,
      watcherName,
      copyFn: debouncedCopy(
        watchPath,
        webIdePath ??
          '../gitlab-web-ide/packages/vscode-extension-gitlab-vscode-extension/dist/gitlab-vscode-extension/dist-browser',
        watcherName,
      ),
    },
    signal,
  );
}

function typecheck(signal) {
  return run('tsc', ['-p', root, '--noEmit'], { cancelSignal: signal });
}

/**
 * Build the extension for browser environment
 * @param {string[]} [args=[]] - Build arguments
 * @param {AbortSignal} [signal] - Optional abort signal to cancel the operation
 * @returns {Promise<void>}
 */
async function buildExtension(args = [], signal) {
  await typecheck(signal);

  await run(
    'esbuild',
    [
      path.join(root, 'src/browser/browser.js'),
      '--bundle',
      '--outfile=dist-browser/browser.js',
      '--external:vscode',
      // For the fs fix, see:
      // https://github.com/tree-sitter/tree-sitter/tree/660481dbf71413eba5a928b0b0ab8da50c1109e0/lib/binding_web#cant-resolve-fs-in-node_modulesweb-tree-sitter
      '--external:fs',
      // `graceful-fs` is a dependency of `enhanced-resolve`, used in the LS. The dependency is not needed, as the LS supplies our own fsClient, so we prevent it from being included in the bundle
      '--external:graceful-fs',
      '--format=cjs',
      '--sourcemap',
      '--platform=browser',
      '--target=chrome103,edge103,firefox102,safari15.6',
      '--source-root=../gitlab-vscode-extension/src',
      '--alias:path=path-browserify',
      '--loader:.html=text',
      ...args,
    ],
    { cancelSignal: signal },
  );
}

export async function buildBrowser() {
  const packageJson = createBrowserPackageJson();

  await commonJobs(ENVIRONMENTS.BROWSER);

  await Promise.all([
    prepareWebviews(browserWebviews, ENVIRONMENTS.BROWSER),
    writePackageJson(packageJson, ENVIRONMENTS.BROWSER),
    buildExtension(process.env.CI ? ['--minify'] : []),
    generateAssets(packageJson, ENVIRONMENTS.BROWSER),
  ]);
}

export async function watchBrowser(signal) {
  const packageJson = createBrowserPackageJson();
  await writePackageJson(packageJson, ENVIRONMENTS.BROWSER);
  copyStaticProjectFiles(ENVIRONMENTS.BROWSER);

  await buildExtension(['--watch'], signal);
}

// eslint-disable-next-line import/no-default-export
export default {};
