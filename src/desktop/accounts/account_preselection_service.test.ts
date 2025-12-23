import { Account } from '../../common/platform/gitlab_account';
import { GitExtensionWrapper } from '../git/git_extension_wrapper';
import { createTokenAccount } from '../test_utils/entities';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { createFakeRepository } from '../test_utils/fake_git_extension';
import { GitLabProject } from '../../common/platform/gitlab_project';
import { tryToGetProjectFromInstance } from '../gitlab/try_to_get_project_from_instance';
import { GitRepositoryImpl } from '../git/new_git';
import { Repository } from '../api/git';
import {
  WorkspaceAccountManager,
  WorkspaceAccountState,
  NO_ACCOUNTS,
  SINGLE_ACCOUNT,
  ACCOUNT_SELECTED,
  MULTIPLE_AVAILABLE_ACCOUNTS,
} from './workspace_account_manager';
import { AccountPreselectionService } from './account_preselection_service';

jest.mock('../gitlab/try_to_get_project_from_instance');

describe('AccountPreselectionService', () => {
  let workspaceAccountManager: WorkspaceAccountManager;
  let gitExtensionWrapper: GitExtensionWrapper;
  let accountChangeCallback: (state: WorkspaceAccountState) => Promise<void>;
  let repoCountChangeCallback: () => Promise<void>;
  let preselectAccountMock: jest.Mock;
  let state: WorkspaceAccountState;
  let repositories: Repository[];

  beforeEach(() => {
    preselectAccountMock = jest.fn();
    state = { type: NO_ACCOUNTS };
    repositories = [];

    workspaceAccountManager = createFakePartial<WorkspaceAccountManager>({
      get state() {
        return state;
      },
      preselectAccount: preselectAccountMock,
      onChange: cb => {
        accountChangeCallback = cb;
        return { dispose: jest.fn() };
      },
    });

    gitExtensionWrapper = createFakePartial<GitExtensionWrapper>({
      get gitRepositories() {
        return repositories.map(r => new GitRepositoryImpl(r));
      },
      onRepositoryCountChanged: cb => {
        repoCountChangeCallback = cb;
        return { dispose: jest.fn() };
      },
    });

    // this side-effect is expected, production code keeps a reference of the Disposable class
    // but the tests don't have to
    // eslint-disable-next-line no-new
    new AccountPreselectionService(workspaceAccountManager, gitExtensionWrapper);
  });

  it.each([
    { type: NO_ACCOUNTS },
    { type: SINGLE_ACCOUNT, account: createTokenAccount() },
    {
      type: ACCOUNT_SELECTED,
      account: createTokenAccount(),
      availableAccounts: [createTokenAccount()],
    },
  ] satisfies WorkspaceAccountState[])('does nothing when the state is %s', async testState => {
    state = testState;
    await accountChangeCallback(state);
    expect(preselectAccountMock).not.toHaveBeenCalled();
  });

  describe('with multiple accounts and repositories', () => {
    let firstAccount: Account;
    let secondAccount: Account;

    beforeEach(() => {
      firstAccount = createTokenAccount('https://gitlab.com', 1);
      secondAccount = createTokenAccount('https://gitlab.com', 2);

      const repository = createFakeRepository({
        remotes: [['origin', 'https://gitlab.com/namespace/project.git']],
      });
      repositories = [repository];

      state = {
        type: MULTIPLE_AVAILABLE_ACCOUNTS,
        availableAccounts: [firstAccount, secondAccount],
      };
    });

    it('selects account when only one account has matching projects', async () => {
      jest.mocked(tryToGetProjectFromInstance).mockImplementation(async (account, path) => {
        if (account.id === firstAccount.id) {
          return { namespaceWithPath: path } as GitLabProject;
        }
        return undefined;
      });

      await accountChangeCallback(state);

      expect(preselectAccountMock).toHaveBeenCalledWith(firstAccount);
    });

    it('does not select account when multiple accounts have matching projects', async () => {
      jest
        .mocked(tryToGetProjectFromInstance)
        .mockImplementation(
          async (_account, path) => ({ namespaceWithPath: path }) as GitLabProject,
        );

      await accountChangeCallback(state);

      expect(preselectAccountMock).not.toHaveBeenCalled();
    });

    it('does not select account when account state changes during project detection', async () => {
      const thirdAccount = createTokenAccount('https://gitlab.com', 3);

      jest.mocked(tryToGetProjectFromInstance).mockImplementation(async () => {
        // Simulate account state change during project detection
        state = {
          type: MULTIPLE_AVAILABLE_ACCOUNTS,
          availableAccounts: [firstAccount, secondAccount, thirdAccount],
        };
        return { namespaceWithPath: 'namespace/project' } as GitLabProject;
      });

      await accountChangeCallback(state);

      expect(preselectAccountMock).not.toHaveBeenCalled();
    });

    it('responds to repository count changes', async () => {
      jest.mocked(tryToGetProjectFromInstance).mockImplementation(async (account, path) => {
        if (account.id === firstAccount.id) {
          return { namespaceWithPath: path } as GitLabProject;
        }
        return undefined;
      });

      await repoCountChangeCallback();

      expect(preselectAccountMock).toHaveBeenCalledWith(firstAccount);
    });
  });
});
