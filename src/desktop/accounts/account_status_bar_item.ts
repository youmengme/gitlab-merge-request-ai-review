import * as vscode from 'vscode';
import { truncate } from 'lodash';
import { log } from '../../common/log';
import { createStatusBarItem } from '../../common/utils/status_bar_item';
import { USER_COMMANDS } from '../command_names';
import {
  WorkspaceAccountManager,
  WorkspaceAccountState,
  NO_ACCOUNTS,
  SINGLE_ACCOUNT,
  ACCOUNT_SELECTED,
  ACCOUNT_PRESELECTED,
  MULTIPLE_AVAILABLE_ACCOUNTS,
} from './workspace_account_manager';

const truncateUsername = (str: string) => truncate(str, { length: 7 });

const hostOnly = (url: string) => vscode.Uri.parse(url)?.authority ?? '';

export class AccountStatusBarItem {
  #codeSuggestionsStatusBarItem: vscode.StatusBarItem;

  #codeSuggestionsStateSubscription: vscode.Disposable;

  #manager: WorkspaceAccountManager;

  constructor(manager: WorkspaceAccountManager) {
    this.#manager = manager;
    this.#codeSuggestionsStatusBarItem = createCodeSuggestionStatusBarItem();

    this.#codeSuggestionsStatusBarItem.show();
    // Reattach the subscription if needed
    this.#codeSuggestionsStateSubscription = this.#manager.onChange(e =>
      this.updateCodeSuggestionsItem(e),
    );
    this.updateCodeSuggestionsItem(this.#manager.state);
  }

  updateCodeSuggestionsItem(state: WorkspaceAccountState) {
    switch (state.type) {
      case NO_ACCOUNTS:
        this.#codeSuggestionsStatusBarItem.hide();
        break;

      case SINGLE_ACCOUNT:
        this.#codeSuggestionsStatusBarItem.hide();
        break;

      case ACCOUNT_SELECTED:
        this.#codeSuggestionsStatusBarItem.show();
        this.#codeSuggestionsStatusBarItem.text = `$(gitlab-logo) ${truncateUsername(state.account.username)}`;
        this.#codeSuggestionsStatusBarItem.tooltip = `Active account: ${state.account.username} (${hostOnly(state.account.instanceUrl)}). Click to change.`;
        this.#codeSuggestionsStatusBarItem.command = USER_COMMANDS.SELECT_WORKSPACE_ACCOUNT;
        break;

      case ACCOUNT_PRESELECTED:
        this.#codeSuggestionsStatusBarItem.show();
        this.#codeSuggestionsStatusBarItem.text = `$(gitlab-logo) ${truncateUsername(state.account.username)}`;
        this.#codeSuggestionsStatusBarItem.tooltip = `Preselected account: ${state.account.username} (${hostOnly(state.account.instanceUrl)}). Click to change.`;
        this.#codeSuggestionsStatusBarItem.command = USER_COMMANDS.SELECT_WORKSPACE_ACCOUNT;
        break;

      case MULTIPLE_AVAILABLE_ACCOUNTS:
        this.#codeSuggestionsStatusBarItem.show();
        this.#codeSuggestionsStatusBarItem.text = `$(question) Multiple GitLab Accounts`;
        this.#codeSuggestionsStatusBarItem.tooltip = 'Click to select the account to use';
        this.#codeSuggestionsStatusBarItem.command = USER_COMMANDS.SELECT_WORKSPACE_ACCOUNT;
        break;
      default:
        this.#codeSuggestionsStatusBarItem.hide();
        log.error(`Unexpected workspace account state ${JSON.stringify(state)}`);
    }
  }

  dispose(): void {
    this.#codeSuggestionsStateSubscription?.dispose();
    this.#codeSuggestionsStatusBarItem?.dispose();
  }
}

function createCodeSuggestionStatusBarItem() {
  return createStatusBarItem({
    priority: Number.MAX_VALUE - 1,
    id: 'gl.status.account',
    name: 'Git',
    initialText: '$(loading) initializing',
    alignment: vscode.StatusBarAlignment.Right,
  });
}
