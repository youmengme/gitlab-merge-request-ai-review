/* eslint-disable no-console */
import * as path from 'path';
import { runTests } from 'vscode-test';

const TEST_WORKSPACE_DIR = path.resolve(__dirname, '../../test_workspace');

async function go() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '..');
    console.log(`extension development path: ${extensionDevelopmentPath}`);
    const extensionTestsPath = path.resolve(__dirname, './integration');
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      version: '1.92.2',
      launchArgs: ['--disable-extensions', '--disable-workspace-trust', TEST_WORKSPACE_DIR],
    });
  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

go().catch(console.error);
