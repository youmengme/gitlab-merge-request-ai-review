import * as vscode from 'vscode';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { USER_COMMANDS } from '../command_names';
import { Account } from '../../common/platform/gitlab_account';
import { createTokenAccount } from '../test_utils/entities';
import {
  WorkspaceAccountManager,
  WorkspaceAccountState,
  NO_ACCOUNTS,
  SINGLE_ACCOUNT,
  ACCOUNT_SELECTED,
  ACCOUNT_PRESELECTED,
  MULTIPLE_AVAILABLE_ACCOUNTS,
} from './workspace_account_manager';
import { AccountStatusBarItem } from './account_status_bar_item';

const createFakeStatusBarItem = (): vscode.StatusBarItem =>
  createFakePartial<vscode.StatusBarItem>({
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  });

describe('AccountStatusBarItem', () => {
  let statusBarItem: vscode.StatusBarItem;
  let workspaceAccountManager: WorkspaceAccountManager;
  let accountStatusBarItem: AccountStatusBarItem;
  let state: WorkspaceAccountState;
  let account: Account;
  let notifyStateChange: () => void;

  beforeEach(() => {
    jest.mocked(vscode.window.createStatusBarItem).mockImplementation(() => {
      statusBarItem = createFakeStatusBarItem();
      return statusBarItem;
    });
    account = {
      ...createTokenAccount(),
      username: 'test-u',
      instanceUrl: 'http://gitlab.test.com',
    };

    workspaceAccountManager = createFakePartial<WorkspaceAccountManager>({
      get state() {
        return state;
      },
      onChange: listener => {
        notifyStateChange = () => listener(state);
        return { dispose: () => {} };
      },
    });

    state = { type: NO_ACCOUNTS };
    accountStatusBarItem = new AccountStatusBarItem(workspaceAccountManager);
  });

  afterEach(() => {
    accountStatusBarItem.dispose();
  });

  describe('status bar item states', () => {
    it('shows no account state correctly', () => {
      state = { type: NO_ACCOUNTS };
      accountStatusBarItem.updateCodeSuggestionsItem(state);

      expect(statusBarItem.hide).toHaveBeenCalled();
    });

    it('shows single account state correctly', () => {
      state = { type: SINGLE_ACCOUNT, account };
      accountStatusBarItem.updateCodeSuggestionsItem(state);

      expect(statusBarItem.hide).toHaveBeenCalled();
    });

    it('shows selected account state correctly', () => {
      state = {
        type: ACCOUNT_SELECTED,
        account,
        availableAccounts: [account],
      };
      accountStatusBarItem.updateCodeSuggestionsItem(state);

      expect(statusBarItem.text).toBe('$(gitlab-logo) test-u');
      expect(statusBarItem.tooltip).toBe(
        'Active account: test-u (gitlab.test.com). Click to change.',
      );
      expect(statusBarItem.command).toBe(USER_COMMANDS.SELECT_WORKSPACE_ACCOUNT);
    });

    it('shows preselected account state correctly', () => {
      state = {
        type: ACCOUNT_PRESELECTED,
        account,
        availableAccounts: [account],
      };
      accountStatusBarItem.updateCodeSuggestionsItem(state);

      expect(statusBarItem.text).toBe('$(gitlab-logo) test-u');
      expect(statusBarItem.tooltip).toBe(
        'Preselected account: test-u (gitlab.test.com). Click to change.',
      );
      expect(statusBarItem.command).toBe(USER_COMMANDS.SELECT_WORKSPACE_ACCOUNT);
    });

    it('shows multiple accounts state correctly', () => {
      state = {
        type: MULTIPLE_AVAILABLE_ACCOUNTS,
        availableAccounts: [account, { ...account, id: '2' }],
      };
      accountStatusBarItem.updateCodeSuggestionsItem(state);

      expect(statusBarItem.text).toBe('$(question) Multiple GitLab Accounts');
      expect(statusBarItem.tooltip).toBe('Click to select the account to use');
      expect(statusBarItem.command).toBe(USER_COMMANDS.SELECT_WORKSPACE_ACCOUNT);
    });
  });

  describe('state change reactions', () => {
    it('updates status bar when state changes', () => {
      // Initial state
      expect(statusBarItem.text).toBe('$(loading) initializing');

      // Change state
      state = {
        type: ACCOUNT_SELECTED,
        account,
        availableAccounts: [account, createTokenAccount()],
      };
      notifyStateChange();

      expect(statusBarItem.text).toBe('$(gitlab-logo) test-u');
      expect(statusBarItem.tooltip).toBe(
        'Active account: test-u (gitlab.test.com). Click to change.',
      );
    });
  });

  describe('username truncation', () => {
    const secondAccount = createTokenAccount();

    it('truncates long usernames', () => {
      const firstAccount = { ...account, username: 'very-long-username' };
      state = {
        type: ACCOUNT_SELECTED,
        account: firstAccount,
        availableAccounts: [firstAccount, secondAccount],
      };
      accountStatusBarItem.updateCodeSuggestionsItem(state);

      expect(statusBarItem.text).toBe('$(gitlab-logo) very...');
    });

    it('does not truncate short usernames', () => {
      const firstAccount = { ...account, username: 'short' };
      state = {
        type: ACCOUNT_SELECTED,
        account: firstAccount,
        availableAccounts: [firstAccount, secondAccount],
      };
      accountStatusBarItem.updateCodeSuggestionsItem(state);

      expect(statusBarItem.text).toBe('$(gitlab-logo) short');
    });
  });
});
