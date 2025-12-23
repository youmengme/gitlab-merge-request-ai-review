import vscode from 'vscode';
import { Account } from '../../common/platform/gitlab_account';
import { diffEmitter } from '../../common/utils/diff_emitter';
import { AccountService } from './account_service';

const SELECTED_ACCOUNT_KEY = 'workspaceSelectedAccountId';

export enum WorkspaceAccountStateType {
  NO_ACCOUNTS = 'no-accounts',
  SINGLE_ACCOUNT = 'single-account',
  ACCOUNT_SELECTED = 'account-selected',
  ACCOUNT_PRESELECTED = 'account-preselected',
  MULTIPLE_AVAILABLE_ACCOUNTS = 'multiple-available-accounts',
}

export const {
  NO_ACCOUNTS,
  SINGLE_ACCOUNT,
  ACCOUNT_SELECTED,
  ACCOUNT_PRESELECTED,
  MULTIPLE_AVAILABLE_ACCOUNTS,
} = WorkspaceAccountStateType;

export type WorkspaceAccountState =
  | { type: typeof NO_ACCOUNTS }
  | { type: typeof SINGLE_ACCOUNT; account: Account }
  | { type: typeof ACCOUNT_SELECTED; account: Account; availableAccounts: Account[] }
  | { type: typeof ACCOUNT_PRESELECTED; account: Account; availableAccounts: Account[] }
  | { type: typeof MULTIPLE_AVAILABLE_ACCOUNTS; availableAccounts: Account[] };

export class WorkspaceAccountManager {
  #accountService: AccountService;

  #workspaceState: vscode.Memento;

  #selectedAccount?: Account;

  #preselectedAccount?: Account;

  #diffEmitter = diffEmitter(new vscode.EventEmitter<WorkspaceAccountState>());

  #subscriptions: vscode.Disposable[] = [];

  onChange = this.#diffEmitter.event;

  constructor(workspaceState: vscode.Memento, accountService: AccountService) {
    this.#accountService = accountService;
    this.#workspaceState = workspaceState;
    this.#subscriptions.push(
      this.#accountService.onDidChange(() => {
        this.#refreshAccounts();
      }),
    );
    this.#refreshAccounts();
  }

  get state(): WorkspaceAccountState {
    const availableAccounts = this.#accountService.getAllAccounts();
    if (availableAccounts.length === 0) return { type: NO_ACCOUNTS };
    if (availableAccounts.length === 1)
      return { type: SINGLE_ACCOUNT, account: availableAccounts[0] };
    if (this.#selectedAccount)
      return {
        type: ACCOUNT_SELECTED,
        account: this.#selectedAccount,
        availableAccounts,
      };
    if (this.#preselectedAccount)
      return {
        type: ACCOUNT_PRESELECTED,
        account: this.#preselectedAccount,
        availableAccounts,
      };
    return { type: MULTIPLE_AVAILABLE_ACCOUNTS, availableAccounts };
  }

  get activeAccount(): Account | undefined {
    return this.state.type === SINGLE_ACCOUNT ||
      this.state.type === ACCOUNT_SELECTED ||
      this.state.type === ACCOUNT_PRESELECTED
      ? this.state.account
      : undefined;
  }

  async preselectAccount(account: Account) {
    this.#preselectedAccount = account;
    this.#diffEmitter.fire(this.state);
  }

  /* The account can be undefined so that we can remove selection (mainly for testing) */
  async selectAccount(account: Account | undefined) {
    await this.#workspaceState.update(SELECTED_ACCOUNT_KEY, account?.id);
    this.#selectedAccount = account;
    this.#diffEmitter.fire(this.state);
  }

  #refreshAccounts() {
    this.#preselectedAccount = undefined;
    const accounts = this.#accountService.getAllAccounts();
    if (accounts.length < 2) {
      this.#selectedAccount = undefined;
    } else {
      const selectedAccountId = this.#workspaceState.get(SELECTED_ACCOUNT_KEY);
      const selectedAccount = accounts.find(a => a.id === selectedAccountId);
      // Clear selected account if it no longer exists
      if (!selectedAccount) {
        this.#selectedAccount = undefined;
      } else {
        this.#selectedAccount = selectedAccount;
      }
    }

    this.#diffEmitter.fire(this.state);
  }
}

let workspaceAccountManager: WorkspaceAccountManager;

export const initWorkspaceAccountManager = (ctx: vscode.ExtensionContext, as: AccountService) => {
  workspaceAccountManager = new WorkspaceAccountManager(ctx.workspaceState, as);
};

export const getWorkspaceAccountManager = () => {
  if (!workspaceAccountManager) throw new Error('WorkspaceAccountManager has not been initialized');
  return workspaceAccountManager;
};
