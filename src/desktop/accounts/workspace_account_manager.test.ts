import vscode from 'vscode';
import { InMemoryMemento } from '../../../test/integration/test_infrastructure/in_memory_memento';
import { Account } from '../../common/platform/gitlab_account';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { createTokenAccount } from '../test_utils/entities';
import { AccountService } from './account_service';
import {
  WorkspaceAccountManager,
  NO_ACCOUNTS,
  SINGLE_ACCOUNT,
  ACCOUNT_SELECTED,
  MULTIPLE_AVAILABLE_ACCOUNTS,
  ACCOUNT_PRESELECTED,
} from './workspace_account_manager';

describe('WorkspaceAccountManager', () => {
  let workspaceState: vscode.Memento;
  let accountService: AccountService;
  let allAccounts: Account[];
  let manager: WorkspaceAccountManager;
  let listener: () => void;

  beforeEach(() => {
    workspaceState = new InMemoryMemento();
    allAccounts = [];
    accountService = createFakePartial<AccountService>({
      getAllAccounts: () => allAccounts,
      onDidChange: l => {
        listener = l;
        return { dispose: () => {} };
      },
    });

    manager = new WorkspaceAccountManager(workspaceState, accountService);
  });

  it('returns no-accounts state', () => {
    expect(manager.state).toEqual({ type: NO_ACCOUNTS });
    expect(manager.activeAccount).toBeUndefined();
  });

  it('returns single-account state when only one account exists', () => {
    const account = createTokenAccount('https://gitlab.com', 1);
    allAccounts = [account];

    expect(manager.state).toEqual({
      type: SINGLE_ACCOUNT,
      account,
    });
    expect(manager.activeAccount).toBe(account);
  });

  it('returns multiple-available-accounts state when multiple accounts exist but none selected', () => {
    allAccounts = [
      createTokenAccount('https://gitlab.com', 1),
      createTokenAccount('https://gitlab.com', 2),
    ];

    expect(manager.state).toEqual({
      type: MULTIPLE_AVAILABLE_ACCOUNTS,
      availableAccounts: allAccounts,
    });
    expect(manager.activeAccount).toBeUndefined();
  });

  it('returns account-selected state when multiple accounts exist and one is selected', async () => {
    const account1 = createTokenAccount('https://gitlab.com', 1);
    const account2 = createTokenAccount('https://gitlab.com', 2);
    allAccounts = [account1, account2];

    await manager.selectAccount(account1);

    expect(manager.state).toEqual({
      type: ACCOUNT_SELECTED,
      account: account1,
      availableAccounts: allAccounts,
    });
    expect(manager.activeAccount).toBe(account1);
  });

  it('fires onChange event when accounts change', () => {
    const onChangeSpy = jest.fn();
    manager.onChange(onChangeSpy);

    // Simulate account service change
    allAccounts = [createTokenAccount('https://gitlab.com', 1)];
    listener();

    expect(onChangeSpy).toHaveBeenCalledWith({
      type: SINGLE_ACCOUNT,
      account: allAccounts[0],
    });
  });

  it('resets to multiple-available-accounts state when selected account is removed', async () => {
    const account1 = createTokenAccount('https://gitlab.com', 1);
    const account2 = createTokenAccount('https://gitlab.com', 2);
    const account3 = createTokenAccount('https://gitlab.com', 3);
    allAccounts = [account1, account2, account3];

    await manager.selectAccount(account1);

    // Simulate account service removing account1 but keeping account2 and account3
    allAccounts = [account2, account3];
    listener();

    expect(manager.state).toEqual({
      type: MULTIPLE_AVAILABLE_ACCOUNTS,
      availableAccounts: [account2, account3],
    });
    expect(manager.activeAccount).toBeUndefined();
  });

  it('returns account-preselected state when account is preselected', async () => {
    const account1 = createTokenAccount('https://gitlab.com', 1);
    const account2 = createTokenAccount('https://gitlab.com', 2);
    allAccounts = [account1, account2];

    await manager.preselectAccount(account1);

    expect(manager.state).toEqual({
      type: ACCOUNT_PRESELECTED,
      account: account1,
      availableAccounts: allAccounts,
    });
    expect(manager.activeAccount).toBe(account1);
  });

  it('clears preselected account when accounts are refreshed', async () => {
    const account1 = createTokenAccount('https://gitlab.com', 1);
    const account2 = createTokenAccount('https://gitlab.com', 2);
    allAccounts = [account1, account2];

    await manager.preselectAccount(account1);
    listener(); // Trigger refresh

    expect(manager.state).toEqual({
      type: MULTIPLE_AVAILABLE_ACCOUNTS,
      availableAccounts: allAccounts,
    });
    expect(manager.activeAccount).toBeUndefined();
  });

  it('does not preselect account when user has manually selected an account', async () => {
    const account1 = createTokenAccount('https://gitlab.com', 1);
    const account2 = createTokenAccount('https://gitlab.com', 2);
    allAccounts = [account1, account2];

    await manager.selectAccount(account1);
    await manager.preselectAccount(account2);

    expect(manager.state).toEqual({
      type: ACCOUNT_SELECTED,
      account: account1,
      availableAccounts: allAccounts,
    });
    expect(manager.activeAccount).toBe(account1);
  });
});
