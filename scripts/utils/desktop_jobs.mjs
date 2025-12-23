import path from 'node:path';
import fs from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { ENVIRONMENTS } from '../constants.mjs';
import { root, run } from './run_utils.mjs';
import { createDesktopPackageJson } from './packages.mjs';
import {
  prepareWebviews,
  generateAssets,
  writePackageJson,
  commonJobs,
  copyStaticProjectFiles,
} from './common_jobs.mjs';

const desktopWebviews = {
  vue3: ['issuable'],
  vue2: ['gitlab_duo_chat', 'security_finding'],
};

export async function copyPendingJobAssets() {
  return copyFile(
    path.join(root, 'webviews/pendingjob.html'),
    path.join(root, `dist-desktop/webviews/pendingjob.html`),
  );
}

export async function compileSource() {
  await run('tsc', ['-p', root]);
}

export async function buildExtension(args = [], signal) {
  await run(
    'esbuild',
    [
      path.join(root, 'src/desktop/extension.js'),
      '--bundle',
      '--outfile=dist-desktop/extension.js',
      '--external:vscode',
      '--platform=node',
      '--target=node18.17',
      '--sourcemap',
      '--loader:.html=text',
      ...args,
    ],
    { cancelSignal: signal },
  );
}

export async function checkAndBuildExtension(args = []) {
  await compileSource();
  await buildExtension(args);
}

/**
 * Copy a directory using native OS utils
 * (not using NodeJS `fs` for performance reasons when copying large node_modules dirs)
 */
async function copyDirectory(sourcePath, destPath) {
  if (process.platform === 'win32') {
    // robocopy copies the contents of source into dest (does NOT create an additional subdirectory named after source)
    // So ensure we handle that by making a more specific destPath
    const sourceDir = path.basename(sourcePath);
    const fullDestPath = path.join(destPath, sourceDir);

    try {
      const reduceOutputVerbosityFlags = ['/NFL', '/NDL', '/NJH', '/NJS', '/nc', '/ns', '/np'];
      const copySubdirectoriesRecursivelyFlag = '/E';
      await run('robocopy', [
        sourcePath,
        fullDestPath,
        copySubdirectoriesRecursivelyFlag,
        ...reduceOutputVerbosityFlags,
      ]);
    } catch (error) {
      // robocopy exits with:
      // 0 - no files copied (no change/no files)
      // 1 - files copied successfully
      // 2+ - some errors occurred
      if (error.exitCode === 1 || error.code === 1) {
        console.log(
          'robocopy exited with code 1. This is not an error, everything copied correctly.',
        );
        return;
      }
      throw error;
    }
  } else {
    await run('cp', ['-R', sourcePath, destPath]);
  }
}

export async function copyNodeModules() {
  await copyDirectory(path.join(root, 'node_modules'), path.join(root, 'dist-desktop'));
}

export async function copyWalkthroughs() {
  await copyDirectory(path.join(root, 'walkthroughs'), path.join(root, 'dist-desktop'));
}

export function watchWebviews(signal) {
  const targets = Object.keys(desktopWebviews);
  targets.forEach(async target => {
    desktopWebviews[target].forEach(webview => {
      const dirpath = path.join(root, `webviews/${target}/dist/${webview}`);
      if (!fs.existsSync(dirpath)) fs.mkdirSync(dirpath, { recursive: true });
      fs.symlinkSync(dirpath, path.join(root, `dist-desktop/webviews/${webview}`));
    });
    await run('npm', ['run', '--prefix', path.join(root, `webviews/${target}`), 'watch'], {
      cancelSignal: signal,
    });
  });
}

export async function buildDesktop() {
  const packageJson = createDesktopPackageJson();

  await commonJobs(ENVIRONMENTS.DESKTOP);

  await Promise.all([
    prepareWebviews(desktopWebviews, ENVIRONMENTS.DESKTOP),
    copyPendingJobAssets(),
    copyStaticProjectFiles(ENVIRONMENTS.DESKTOP),
    copyWalkthroughs(),
    checkAndBuildExtension(['--minify']),
    generateAssets(packageJson, ENVIRONMENTS.DESKTOP),
  ]);

  // we need to wait for `tsc` to compile so we can replace package.json
  await writePackageJson(packageJson, ENVIRONMENTS.DESKTOP);
}

export async function watchDesktop(signal) {
  const packageJson = createDesktopPackageJson();
  await compileSource();
  await writePackageJson(packageJson, ENVIRONMENTS.DESKTOP);
  copyStaticProjectFiles(ENVIRONMENTS.DESKTOP);
  copyWalkthroughs();
  await buildExtension(['--watch'], signal);
}

export async function buildPackage(options, isPreReleaseBuild) {
  const args = ['--no-dependencies'];
  if (isPreReleaseBuild) {
    args.push('--pre-release');
  }
  await run('vsce', ['package', ...args], options);
}
