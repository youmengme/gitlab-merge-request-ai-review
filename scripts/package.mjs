import path from 'path';
import { root } from './utils/run_utils.mjs';
import { buildDesktop, buildPackage, copyNodeModules } from './utils/desktop_jobs.mjs';

const PRE_RELEASE_ARG = '--pre-release';

async function build(buildOptions) {
  await buildDesktop();
  await copyNodeModules();
  await buildPackage({ cwd: path.resolve(root, 'dist-desktop') }, buildOptions.isPreReleaseBuild);
}

const args = process.argv.slice(2);

const isPreReleaseBuild = args.includes(PRE_RELEASE_ARG);

const buildOptions = { isPreReleaseBuild };

build(buildOptions);
