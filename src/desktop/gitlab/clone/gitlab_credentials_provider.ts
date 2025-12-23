import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { Credentials, CredentialsProvider } from '../../api/git';
import { accountService } from '../../accounts/account_service';

export const gitlabCredentialsProvider: CredentialsProvider = {
  async getCredentials(host: Uri): Promise<Credentials | undefined> {
    const accounts = accountService.getAllAccounts().filter(a => {
      const instanceURI = Uri.parse(a.instanceUrl);
      return host.scheme === instanceURI.scheme && host.authority === instanceURI.authority;
    });
    if (accounts.length === 1) {
      return {
        username: 'arbitrary_username_ignored_by_gitlab',
        password: accounts[0].token,
      };
    }
    if (accounts.length > 1) {
      const options = accounts.map(a => ({ label: a.username, account: a }));
      const choice = await vscode.window.showQuickPick(options, {
        title: 'Perform the checkout as user',
      });
      if (!choice) {
        return undefined;
      }
      return {
        username: 'arbitrary_username_ignored_by_gitlab',
        password: choice.account.token,
      };
    }

    return undefined;
  },
};
