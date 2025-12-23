import path from 'node:path';
import fs from 'node:fs/promises';
import { rimraf } from 'rimraf';
import { root, run } from './utils/run_utils.mjs';

/**
 * Transforms dependencies using ES6 modules to CommonJS. Otherwise, we can't require
 * these dependencies from CommonJS modules without using dynamic imports.
 *
 * This is necessary only for integration tests, not production
 *
 * This fixes the following error:
 *
 * Error [ERR_REQUIRE_ESM]: require() of ES Module ... not supported.
 * Instead change the require .. to a dynamic import() which is available in all CommonJS modules.
 */
async function processModule(module) {
  try {
    const sourceDir = path.join(root, 'node_modules', module);
    const targetDir = path.join(root, 'dist-desktop/node_modules', module);

    // remove the original module
    await rimraf(targetDir);

    // transpile the ES module with babel to make it commonJS
    await run('babel', [sourceDir, '--out-dir', targetDir]);

    // copy package.json, but remove the ES module mark (type: module)
    const packageJsonPath = path.join(sourceDir, 'package.json');
    const destPackageJsonPath = path.join(targetDir, 'package.json');

    await fs.access(packageJsonPath); // check that file exists

    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    delete packageJson.type;
    await fs.writeFile(destPackageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log(`Successfully transpiled ES module ${module} to CommonJS`);
  } catch (error) {
    console.error(`Error when transpiling ES module ${module} to CommonJS`);
    throw error;
  }
}

async function main() {
  const modules = ['@anycable/core', 'nanoevents', 'p-queue', 'p-timeout'];

  await Promise.all(modules.map(module => processModule(module)));
}

main();
