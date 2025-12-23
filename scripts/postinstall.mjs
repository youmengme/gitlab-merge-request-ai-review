import path from 'node:path';
import { root, run } from './utils/run_utils.mjs';

/**
 * Call npm ci/install in every subfolder with a package.json.
 */
async function main() {
  const files = ['webviews/vue3', 'webviews/vue2', 'scripts/commit-lint'];

  for (const folder of files) {
    // we use the npm command that triggered this script (install/ci)
    // eslint-disable-next-line no-await-in-loop
    await run('npm', [process.env.npm_command], { cwd: path.join(root, folder) });
  }
}

main();
