import { Disposable } from 'vscode';
import { API } from '../../api/git';
import { accountService } from '../../accounts/account_service';
import { Account } from '../../../common/platform/gitlab_account';
import { GitLabRemoteSource } from './gitlab_remote_source';

/**
 * This class manages the creation and deletion of RemoteSources for the git.clone command for each configured instance url
 */
export class GitLabRemoteSourceRepository implements Disposable {
  #remoteSources = new Map<string, { source: GitLabRemoteSource; disposable: Disposable }>();

  #accountServiceListener: Disposable;

  #gitAPI: API;

  constructor(gitAPI: API) {
    this.#gitAPI = gitAPI;
    this.update();
    this.#accountServiceListener = accountService.onDidChange(this.update, this);
  }

  update(): void {
    const accounts = accountService.getAllAccounts();
    // create provider(s) for the missing url(s)
    accounts.forEach(account => {
      if (!this.#remoteSources.has(account.id)) {
        const source = new GitLabRemoteSource(account, this.#gitAPI);
        const disposable = Disposable.from(
          this.#gitAPI.registerRemoteSourceProvider(source),
          this.#gitAPI.registerRemoteSourcePublisher(source),
        );
        this.#remoteSources.set(account.id, { source, disposable });
      }
    });
    // delete provider(s) for removed url(s)
    const accountIds = new Set(accounts.map(a => a.id));
    const idsToDelete = Array.from(this.#remoteSources.keys()).filter(
      accountId => !accountIds.has(accountId),
    );

    idsToDelete.forEach(id => {
      this.#remoteSources.get(id)?.disposable.dispose();
      this.#remoteSources.delete(id);
    });
  }

  getSourceForAccount(account: Account) {
    return this.#remoteSources.get(account.id)?.source;
  }

  dispose(): void {
    this.#remoteSources.forEach(({ disposable }) => disposable?.dispose());
    this.#remoteSources.clear();
    this.#accountServiceListener.dispose();
  }
}
