import * as vscode from 'vscode';
import { isEmpty } from 'lodash';
import { pickAccount } from '../gitlab/pick_account';
import { gitExtensionWrapper } from '../git/git_extension_wrapper';

export async function publishToGitlab(): Promise<void> {
  const { remoteSourceRepository } = gitExtensionWrapper;
  if (!remoteSourceRepository) {
    await vscode.window.showErrorMessage('Git extension is not initialized.');
    return;
  }

  const workspaces = vscode.workspace.workspaceFolders;
  if (!workspaces || isEmpty(workspaces)) return;

  const account = await pickAccount();
  if (!account) return;

  const source = remoteSourceRepository.getSourceForAccount(account);
  if (!source) return;

  if (workspaces.length > 1) {
    const selection = await vscode.window.showQuickPick(
      workspaces.map(folder => ({ label: folder.name, description: folder.uri.fsPath, folder })),
      {
        placeHolder: 'Pick a folder to publish to GitLab',
      },
    );
    if (selection) {
      await source.publishFolder(selection.folder.uri);
    }
  } else {
    await source.publishFolder(workspaces[0].uri);
  }
}
