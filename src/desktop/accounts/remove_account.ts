import vscode from 'vscode';
import { accountService } from './account_service';

export async function removeAccount() {
  const accounts = await accountService.getUpToDateRemovableAccounts();
  if (accounts.length === 0) {
    await vscode.window.showInformationMessage(`No accounts to remove!`);
    return;
  }
  const result = await vscode.window.showQuickPick(
    accounts.map(a => ({ label: a.instanceUrl, description: a.username, id: a.id })),
    {
      ignoreFocusOut: true,
      placeHolder: 'Select GitLab instance for PAT removal',
    },
  );

  if (result) {
    await accountService.removeAccount(result.id);
  }
}
