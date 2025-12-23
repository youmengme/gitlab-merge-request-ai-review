import * as vscode from 'vscode';
import { extensionConfigurationService } from '../common/utils/extension_configuration_service';
import { gitExtensionWrapper } from './git/git_extension_wrapper';
import {
  WorkspaceAccountManager,
  NO_ACCOUNTS,
  MULTIPLE_AVAILABLE_ACCOUNTS,
} from './accounts/workspace_account_manager';

const CONTEXT_REMOTE_ENV = 'gitlab:isRemoteEnvironment';
const CONTEXT_NO_ACCOUNT = 'gitlab:noAccount';
const CONTEXT_OPEN_REPO_COUNT = 'gitlab:openRepositoryCount';
const CONTEXT_VALID_STATE = 'gitlab:validState';
const CONTEXT_SHOULD_SELECT_ACCOUNT = 'gitlab:shouldSelectAccount';

const openRepositoryCount = (): number => gitExtensionWrapper.gitRepositories.length;

const setContext = (name: string, value: unknown) =>
  vscode.commands.executeCommand('setContext', name, value);

export class ExtensionState {
  #changeValidEmitter = new vscode.EventEmitter<void>();

  onDidChangeValid = this.#changeValidEmitter.event;

  #workspaceAccountManager: WorkspaceAccountManager;

  #lastValid = false;

  constructor(workspaceAccountManager: WorkspaceAccountManager) {
    this.#workspaceAccountManager = workspaceAccountManager;
    workspaceAccountManager.onChange(this.#updateExtensionStatus, this);
    extensionConfigurationService.onChange(this.#updateExtensionStatus, this);
    this.#lastValid = this.isValid();
  }

  async init(): Promise<void> {
    gitExtensionWrapper.onRepositoryCountChanged(this.#updateExtensionStatus, this);
    await this.#updateExtensionStatus();
  }

  #hasAnyAccounts(): boolean {
    return this.#workspaceAccountManager.state.type !== NO_ACCOUNTS;
  }

  isValid(): boolean {
    return this.#hasAnyAccounts() && openRepositoryCount() > 0 && !this.#shouldSelectAccount();
  }

  #shouldSelectAccount(): boolean {
    return this.#workspaceAccountManager.state.type === MULTIPLE_AVAILABLE_ACCOUNTS;
  }

  async #updateExtensionStatus(): Promise<void> {
    await setContext(CONTEXT_REMOTE_ENV, Boolean(vscode.env.remoteName));
    await setContext(CONTEXT_NO_ACCOUNT, !this.#hasAnyAccounts());
    await setContext(CONTEXT_OPEN_REPO_COUNT, openRepositoryCount());
    await setContext(CONTEXT_SHOULD_SELECT_ACCOUNT, this.#shouldSelectAccount());
    await setContext(CONTEXT_VALID_STATE, this.isValid());

    if (this.#lastValid !== this.isValid()) {
      this.#lastValid = this.isValid();
      this.#changeValidEmitter.fire();
    }
  }
}

let extensionState: ExtensionState;

export const setExtensionStateSingleton = (state: ExtensionState) => {
  extensionState = state;
};

/* @deprecated Try to pass in the ExtensionState in the constructor rather than using this singleton */
export const getExtensionStateSingleton = () => {
  if (!extensionState) throw new Error('ExtensionState has not been initialized.');
  return extensionState;
};
