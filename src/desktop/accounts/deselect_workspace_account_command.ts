import { WorkspaceAccountManager, ACCOUNT_SELECTED } from './workspace_account_manager';

export const createDeselectWorkspaceAccountCommand =
  (accountManager: WorkspaceAccountManager) => async () => {
    if (accountManager.state.type === ACCOUNT_SELECTED) {
      await accountManager.selectAccount(undefined);
    }
  };
