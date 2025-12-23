import { getActiveProjectOrSelectOne, getActiveProject } from '../commands/run_with_valid_project';
import { createOAuthAccount, projectInRepository } from '../test_utils/entities';
import { account, gqlProject, project } from '../../common/test_utils/entities';
import { GetRequest } from '../../common/platform/web_ide';
import { Credentials } from '../../common/platform/gitlab_account';
import { accountService } from '../accounts/account_service';
import {
  getWorkspaceAccountManager,
  WorkspaceAccountManager,
} from '../accounts/workspace_account_manager';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { getGitLabService, getGitLabServiceForAccount } from './get_gitlab_service';
import { gitlabPlatformManagerDesktop } from './gitlab_platform_desktop';
import { getProjectRepository, GitLabProjectRepository } from './gitlab_project_repository';

jest.mock('../../common/feature_flags/local_feature_flag_service');
jest.mock('../accounts/workspace_account_manager');
jest.mock('./pick_account', () => ({
  pickAccount: jest.fn(),
}));

let saasAccount: Credentials | undefined;
jest.mock('../accounts/account_service', () => ({
  accountService: {
    getAllAccounts: jest.fn().mockImplementation(() => [saasAccount]),
    getAccount: jest.fn().mockImplementation(() => projectInRepository.account),
  },
}));

jest.mock('./gitlab_project_repository');

jest.mock('../commands/run_with_valid_project', () => ({
  getActiveProject: jest.fn(),
  getActiveProjectOrSelectOne: jest.fn(),
}));

jest.mock('./get_gitlab_service', () => ({
  getGitLabService: jest.fn(),
  getGitLabServiceForAccount: jest.fn(),
}));

describe('gitlabPlatformManagerDesktop', () => {
  beforeEach(() => {
    jest.mocked(getProjectRepository).mockReturnValue(
      createFakePartial<GitLabProjectRepository>({
        onProjectChange: jest.fn(listener => listener([])), // immediately invoke added listener
      }),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    (getGitLabService as jest.Mock).mockReturnValue({
      fetchFromApi: async () => gqlProject,
    });
  });

  describe('getForActiveProject', () => {
    describe('non user interactive', () => {
      it('fetches the platform for active project when an active project exists', async () => {
        (getActiveProject as jest.Mock).mockResolvedValue(projectInRepository);

        const platform = await gitlabPlatformManagerDesktop.getForActiveProject(false);
        expect(platform).toBeDefined();
        expect(platform?.project).toEqual(project);
        expect(getActiveProject).toHaveBeenCalledTimes(1);
      });

      it('returns undefined when an active project does not exist', async () => {
        (getActiveProject as jest.Mock).mockResolvedValue(undefined);

        const platform = await gitlabPlatformManagerDesktop.getForActiveProject(false);
        expect(platform).toBeUndefined();
        expect(getActiveProject).toHaveBeenCalledTimes(1);
      });
    });

    describe('user interactive', () => {
      it('fetches the platform for active project when an active project exists', async () => {
        (getActiveProjectOrSelectOne as jest.Mock).mockResolvedValue(projectInRepository);

        const platform = await gitlabPlatformManagerDesktop.getForActiveProject(true);
        expect(platform).toBeDefined();
        expect(platform?.project).toEqual(project);
        expect(getActiveProjectOrSelectOne).toHaveBeenCalledTimes(1);
      });

      it('returns undefined when an active project does not exist', async () => {
        (getActiveProjectOrSelectOne as jest.Mock).mockResolvedValue(undefined);

        const platform = await gitlabPlatformManagerDesktop.getForActiveProject(true);
        expect(platform).toBeUndefined();
      });
    });
  });

  describe('getForActiveAccount', () => {
    it('returns the account from workspace account manager', async () => {
      const activeAccount = createOAuthAccount();
      jest.mocked(getWorkspaceAccountManager).mockReturnValue(
        createFakePartial<WorkspaceAccountManager>({
          activeAccount,
        }),
      );

      const platform = await gitlabPlatformManagerDesktop.getForActiveAccount(false);

      expect(platform?.account).toBe(activeAccount);
    });
  });

  describe('onAccountChange', () => {
    it('listens on project changes (as proxy to account changes)', async () => {
      const listener = jest.fn();

      gitlabPlatformManagerDesktop.onAccountChange(listener); // the project repository mock will immediately call the listener

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('fetchFromApi', () => {
    const req: GetRequest<string> = {
      type: 'rest',
      method: 'GET',
      path: '/test',
    };

    describe('with GitLabPlatformForActiveAccount', () => {
      it('calls fetchFromApi', async () => {
        jest.mocked(accountService.getAllAccounts).mockReturnValue([account]);
        (getGitLabServiceForAccount as jest.Mock).mockReturnValue({
          fetchFromApi: async () => gqlProject,
        });

        const platform = await gitlabPlatformManagerDesktop.getForActiveAccount(false);
        const result = await platform?.fetchFromApi(req);
        expect(result).toBe(gqlProject);
        expect(getGitLabServiceForAccount).toHaveBeenCalledTimes(1);
      });
    });

    it('calls fetchFromApi', async () => {
      jest.mocked(getActiveProject).mockReturnValue(projectInRepository);
      const platform = await gitlabPlatformManagerDesktop.getForActiveProject(false);
      const result = await platform?.fetchFromApi(req);
      expect(result).toBe(gqlProject);
      expect(getGitLabServiceForAccount).toHaveBeenCalledWith(projectInRepository.account);
    });
  });

  describe('connectToCable', () => {
    const connectionMock = jest.fn();

    it('calls connectToCable on gitlabService', async () => {
      (getGitLabServiceForAccount as jest.Mock).mockReturnValue({
        connectToCable: async () => connectionMock,
      });

      const platform = await gitlabPlatformManagerDesktop.getForActiveAccount(false);
      const result = await platform?.connectToCable();
      expect(result).toBe(connectionMock);
      expect(getGitLabServiceForAccount).toHaveBeenCalledTimes(1);
    });
  });
});
