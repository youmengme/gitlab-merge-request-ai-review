import vscode from 'vscode';
import { Account } from '../../common/platform/gitlab_account';
import { Snowplow } from '../../common/snowplow/snowplow';
import {
  EXTENSION_EVENT_SOURCE,
  GITLAB_STANDARD_SCHEMA_URL,
} from '../../common/snowplow/snowplow_options';
import { getEnvironment } from '../../common/snowplow/get_environment';
import {
  WorkspaceAccountManager,
  NO_ACCOUNTS,
  SINGLE_ACCOUNT,
  ACCOUNT_SELECTED,
  ACCOUNT_PRESELECTED,
  WorkspaceAccountState,
} from './workspace_account_manager';

export interface AccountQuickPickItem extends vscode.QuickPickItem {
  account: Account;
}

const getAvailableAccounts = (state: WorkspaceAccountState): Account[] => {
  if (state.type === NO_ACCOUNTS) return [];
  if (state.type === SINGLE_ACCOUNT) return [state.account];

  if (state.type === ACCOUNT_SELECTED || state.type === ACCOUNT_PRESELECTED) {
    const activeAccount = state.account;
    return [activeAccount, ...state.availableAccounts.filter(a => a.id !== activeAccount.id)];
  }

  return state.availableAccounts;
};

const trackCommand = async (instanceUrl: string) => {
  const standardContext = {
    schema: GITLAB_STANDARD_SCHEMA_URL,
    data: {
      environment: getEnvironment(instanceUrl),
      source: EXTENSION_EVENT_SOURCE,
    },
  };
  await Snowplow.getInstance().trackStructEvent(
    {
      category: 'account_management',
      action: 'select_workspace_account_command',
    },
    [standardContext, 'ide-extension-context'],
  );
};

export const createSelectWorkspaceAccountCommand =
  (accountManager: WorkspaceAccountManager) => async () => {
    if (accountManager.state.type === NO_ACCOUNTS) return;
    const quickPickItems: AccountQuickPickItem[] = [
      ...getAvailableAccounts(accountManager.state).map(account => ({
        label: account.username,
        description: account.instanceUrl,
        account,
      })),
    ];

    const selected = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: 'Select GitLab account to use in this workspace',
      title: 'Select Workspace Account',
    });

    if (!selected) return;

    await trackCommand(selected.account.instanceUrl);

    await accountManager.selectAccount(selected.account);
  };
