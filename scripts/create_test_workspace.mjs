import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import simpleGit from 'simple-git';
import * as sharedConstants from '../test/integration/test_infrastructure/shared_constants.js';

const { REMOTE, DEFAULT_VS_CODE_SETTINGS } = sharedConstants;
const dir = path.dirname(fileURLToPath(import.meta.url));
const TEST_WORKSPACE_FOLDER = path.join(dir, '../test_workspace');

function createTestWorkspaceFolder() {
  if (fs.existsSync(TEST_WORKSPACE_FOLDER)) {
    fs.rmSync(TEST_WORKSPACE_FOLDER, { recursive: true });
  }
  fs.mkdirSync(TEST_WORKSPACE_FOLDER);
}

async function addFile(folderPath, relativePath, content) {
  const fullPath = path.join(folderPath, relativePath);
  const target = path.dirname(fullPath);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target);
  }
  fs.writeFileSync(fullPath, content);
}

async function main() {
  createTestWorkspaceFolder();
  const git = simpleGit(TEST_WORKSPACE_FOLDER, { binary: 'git' });

  // the new version of git support set `init.defaultBranch` globally to customize the default branch name.
  // we need to pass `--initial-branch` option to restore the default branch name to `master`.
  // but the old version of git does not support this option, so we need to try-catch that.
  try {
    await git.init({ '--initial-branch': 'master' });
  } catch (error) {
    await git.init();
  }

  await git.addRemote(REMOTE.NAME, REMOTE.URL);
  await git.addConfig('user.email', 'test@example.com');
  await git.addConfig('user.name', 'Test Name');
  await git.commit('Test commit', [], {
    '--allow-empty': null,
  });
  await addFile(
    TEST_WORKSPACE_FOLDER,
    '/.vscode/settings.json',
    JSON.stringify(DEFAULT_VS_CODE_SETTINGS),
  );
}

main();
