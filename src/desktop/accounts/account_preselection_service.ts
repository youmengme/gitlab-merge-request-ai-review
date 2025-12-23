import vscode from 'vscode';
import { isEqual } from 'lodash';
import { Account } from '../../common/platform/gitlab_account';
import { uniq } from '../utils/uniq';
import { createRemoteUrlPointers } from '../git/new_git';
import { GitExtensionWrapper } from '../git/git_extension_wrapper';
import { ExistingProject } from '../gitlab/new_project';
import { tryToGetProjectFromInstance } from '../gitlab/try_to_get_project_from_instance';
import { hasPresentKey } from '../utils/has_present_key';
import { parseProjects } from '../git/git_remote_parser';
import {
  WorkspaceAccountManager,
  MULTIPLE_AVAILABLE_ACCOUNTS,
  ACCOUNT_PRESELECTED,
} from './workspace_account_manager';

export class AccountPreselectionService implements vscode.Disposable {
  #workspaceAccountManager: WorkspaceAccountManager;

  #gitExtensionWrapper: GitExtensionWrapper;

  #subscriptions: vscode.Disposable[] = [];

  constructor(
    workspaceAccountManager: WorkspaceAccountManager,
    gitExtensionWrapper: GitExtensionWrapper,
  ) {
    this.#workspaceAccountManager = workspaceAccountManager;
    this.#gitExtensionWrapper = gitExtensionWrapper;

    // Subscribe to state changes
    this.#subscriptions.push(
      this.#workspaceAccountManager.onChange(this.#tryToPreselectAccount.bind(this)),
    );
    this.#subscriptions.push(
      this.#gitExtensionWrapper.onRepositoryCountChanged(this.#tryToPreselectAccount.bind(this)),
    );
  }

  dispose(): void {
    this.#subscriptions.forEach(d => d.dispose());
  }

  async #tryToPreselectAccount(): Promise<void> {
    const { state } = this.#workspaceAccountManager;
    if (state.type !== MULTIPLE_AVAILABLE_ACCOUNTS && state.type !== ACCOUNT_PRESELECTED) {
      return;
    }

    const initialAccountIds = new Set(state.availableAccounts.map(a => a.id));

    const pointers = this.#gitExtensionWrapper.gitRepositories.flatMap(createRemoteUrlPointers);
    const remoteUrls = uniq(pointers.map(p => p.urlEntry.url));

    const accountsWithMaybeProjects = await Promise.all(
      state.availableAccounts.map(async account => {
        const projects = await this.#detectProjectsForAccount(account, remoteUrls);
        return { account, projects };
      }),
    );

    const accountsWithProjects = accountsWithMaybeProjects.filter(ap => ap.projects.length > 0);

    if (this.#stateHasNotChanged(initialAccountIds) && accountsWithProjects.length === 1) {
      await this.#workspaceAccountManager.preselectAccount(accountsWithProjects[0].account);
    }
  }

  async #detectProjectsForAccount(
    account: Account,
    remoteUrls: string[],
  ): Promise<ExistingProject[]> {
    const parsedProjects = parseProjects(remoteUrls, account.instanceUrl);
    const projectsWithCredentials = parsedProjects.map(pp => ({ ...pp, account }));

    const loadedProjects = await Promise.all(
      projectsWithCredentials.map(async p => {
        const project = await tryToGetProjectFromInstance(p.account, p.namespaceWithPath);
        return { ...p, project };
      }),
    );

    return loadedProjects.filter(hasPresentKey('project'));
  }

  #stateHasNotChanged(initialAccountIds: Set<string>): boolean {
    const currentState = this.#workspaceAccountManager.state;
    return (
      currentState.type === MULTIPLE_AVAILABLE_ACCOUNTS &&
      isEqual(new Set(currentState.availableAccounts.map(a => a.id)), initialAccountIds)
    );
  }
}
