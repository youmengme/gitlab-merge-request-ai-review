import { parseArgs } from 'node:util';
import fs from 'node:fs';
import { commonJobs, generateAssets, writePackageJson } from './utils/common_jobs.mjs';
import { createBrowserPackageJson } from './utils/packages.mjs';
import { ENVIRONMENTS } from './constants.mjs';
import { watchBrowser, watchWebviews, watchBuild } from './utils/browser_jobs.mjs';

async function getOptions() {
  const { values } = parseArgs({
    options: {
      webIde: {
        type: 'string',
      },
      webide: {
        type: 'string',
      },
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
    allowPositionals: false,
  });

  // Handle case insensitive webIde flag
  const webIdePath = values.webIde || values.webide;

  if (webIdePath) {
    try {
      await fs.accessSync(webIdePath);
    } catch (error) {
      console.error(`The provided path to gitlab-web-ide is invalid: ${webIdePath}`);
      process.exit(1);
    }
  }

  if (values.help) {
    console.log(`
Usage: npm run watch:browser [options]
Options:
  --webIde <path>  Path to Web IDE directory for copying build output
  --webide <path>  (case insensitive alternative to --webIde)
  --help, -h       Show this help message
`);
    process.exit(0);
  }

  return { ...values, webIde: webIdePath };
}

async function main() {
  const options = getOptions();
  const packageJson = createBrowserPackageJson();
  await commonJobs(ENVIRONMENTS.BROWSER);

  await Promise.all([
    writePackageJson(packageJson, ENVIRONMENTS.BROWSER),
    generateAssets(packageJson, ENVIRONMENTS.BROWSER),
  ]);
  const abortController = new AbortController();
  process.on('exit', () => abortController.abort());
  ['SIGINT', 'SIGQUIT', 'SIGHUP'].forEach(signal => {
    process.on(signal, () => abortController.abort());
  });
  watchBrowser(abortController.signal);
  watchWebviews(abortController.signal);
  watchBuild(options.webIde, abortController.signal);
}

main();
