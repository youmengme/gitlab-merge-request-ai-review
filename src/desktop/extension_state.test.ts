import * as vscode from 'vscode';
import { account } from '../common/test_utils/entities';
import { createFakePartial } from '../common/test_utils/create_fake_partial';
import { ExtensionState } from './extension_state';
import { gitExtensionWrapper } from './git/git_extension_wrapper';
import { GitRepository } from './git/new_git';
import {
  WorkspaceAccountManager,
  WorkspaceAccountState,
  NO_ACCOUNTS,
  SINGLE_ACCOUNT,
  MULTIPLE_AVAILABLE_ACCOUNTS,
} from './accounts/workspace_account_manager';
import { createTokenAccount } from './test_utils/entities';

jest.mock('../common/utils/extension_configuration');

const noAccountsState: WorkspaceAccountState = {
  type: NO_ACCOUNTS,
};

const singleAccountState: WorkspaceAccountState = {
  type: SINGLE_ACCOUNT,
  account,
};

const multipleAccountsState: WorkspaceAccountState = {
  type: MULTIPLE_AVAILABLE_ACCOUNTS,
  availableAccounts: [createTokenAccount('A'), createTokenAccount('B')],
};

describe('extension_state', () => {
  let extensionState: ExtensionState;
  let mockedState: WorkspaceAccountState;
  let mockedRepositories: GitRepository[];
  let mockedAccountManager: WorkspaceAccountManager;

  beforeEach(() => {
    mockedRepositories = [];
    mockedState = noAccountsState;
    jest
      .spyOn(gitExtensionWrapper, 'gitRepositories', 'get')
      .mockImplementation(() => mockedRepositories);
    mockedAccountManager = createFakePartial<WorkspaceAccountManager>({
      get state() {
        return mockedState;
      },
      onChange: jest.fn(),
    });
    extensionState = new ExtensionState(mockedAccountManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each`
    scenario                             | state                 | repositories        | validState | noAccount | openRepositoryCount
    ${'is invalid'}                      | ${noAccountsState}    | ${[]}               | ${false}   | ${true}   | ${0}
    ${'is invalid without accounts'}     | ${noAccountsState}    | ${['repository']}   | ${false}   | ${true}   | ${1}
    ${'is invalid without repositories'} | ${singleAccountState} | ${[]}               | ${false}   | ${false}  | ${0}
    ${'is valid'}                        | ${singleAccountState} | ${[['repository']]} | ${true}    | ${false}  | ${1}
  `('$scenario', async ({ state, repositories, validState, noAccount, openRepositoryCount }) => {
    mockedState = state;
    mockedRepositories = repositories;
    await extensionState.init();

    const { executeCommand } = vscode.commands;
    expect(executeCommand).toHaveBeenCalledWith('setContext', 'gitlab:validState', validState);
    expect(executeCommand).toHaveBeenCalledWith('setContext', 'gitlab:noAccount', noAccount);
    expect(executeCommand).toHaveBeenCalledWith(
      'setContext',
      'gitlab:openRepositoryCount',
      openRepositoryCount,
    );
  });

  describe('when we should select account', () => {
    beforeEach(() => {
      mockedState = multipleAccountsState;
      mockedRepositories = [{ rootFsPath: 'repository' } as GitRepository];
    });
    it('is invalid', async () => {
      await extensionState.init();

      expect(extensionState.isValid()).toBe(false);
    });
  });

  it('fires event when valid state changes', async () => {
    await extensionState.init();
    const stateChangedListener = jest.fn();
    extensionState.onDidChangeValid(stateChangedListener);
    // setting tokens and repositories makes extension state valid
    mockedState = singleAccountState;
    mockedRepositories = [{ rootFsPath: 'repository' } as GitRepository];

    const listener = jest.mocked(mockedAccountManager.onChange).mock.calls[0][0];
    await listener.bind(extensionState)(singleAccountState);

    expect(stateChangedListener).toHaveBeenCalled();
  });
});
