import vscode from 'vscode';
import { differenceBy } from 'lodash';
import { accountService, AccountService } from '../account_service';
import { Account } from '../../../common/platform/gitlab_account';

const convertAccountToSession = (account: Account): vscode.AuthenticationSession => ({
  accessToken: account.token,
  id: account.id,
  scopes: ['api'],
  account: {
    id: account.id,
    label: `${account.username} - ${account.instanceUrl}`,
  },
});

const makeDiff = (prev: Account[], next: Account[]) => {
  const added = differenceBy(next, prev, a => a.id).map(convertAccountToSession);
  const removed = differenceBy(prev, next, a => a.id).map(convertAccountToSession);
  return { added, removed, changed: undefined };
};

export class GitLabAuthenticationProvider implements vscode.AuthenticationProvider {
  #eventEmitter =
    new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();

  #accountService: AccountService;

  #prevAccounts: Account[];

  constructor(as = accountService) {
    this.#accountService = as;
    this.#accountService.onDidChange(() => {
      this.#eventEmitter.fire(makeDiff(this.#prevAccounts, this.#accountService.getAllAccounts()));
      this.#prevAccounts = this.#accountService.getAllAccounts();
    });
    this.#prevAccounts = this.#accountService.getAllAccounts();
  }

  onDidChangeSessions = this.#eventEmitter.event;

  async getSessions(scopes?: readonly string[]): Promise<vscode.AuthenticationSession[]> {
    if (scopes && !scopes.includes('api')) return [];
    return this.#accountService.getAllAccounts().map(convertAccountToSession);
  }

  async createSession(/* scopes: readonly string[] */): Promise<vscode.AuthenticationSession> {
    // This would show to 3rd party extensions depending on our Auth provider.
    throw new Error(
      'Creating `gitlab.com` sessions from other extensions is not supported. Please create an issue if you are a 3rd party extension author and you would like to reuse GitLab account from the GitLab extension.',
    );
  }

  async removeSession(sessionId: string): Promise<void> {
    await this.#accountService.removeAccount(sessionId);
  }
}
