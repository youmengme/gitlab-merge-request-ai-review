import { GitExtensionWrapper } from '../git/git_extension_wrapper';
import { createRemoteUrlPointers, GitRepositoryImpl } from '../git/new_git';
import { log } from '../../common/log';
import { AccountService } from '../accounts/account_service';
import { createOAuthAccount, createTokenAccount } from '../test_utils/entities';
import { createFakeRepository } from '../test_utils/fake_git_extension';
import { GitLabProject } from '../../common/platform/gitlab_project';
import { WorkspaceAccountManager } from '../accounts/workspace_account_manager';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { Account } from '../../common/platform/gitlab_account';
import { GitLabProjectRepositoryImpl, initializeAllProjects } from './gitlab_project_repository';
import { SelectedProjectSetting } from './new_project';
import { SelectedProjectStore } from './selected_project_store';
import { tryToGetProjectFromInstance } from './try_to_get_project_from_instance';

jest.mock('../../common/log');
jest.mock('./try_to_get_project_from_instance');

describe('gitlab_project_repository', () => {
  let projects: Record<string, string[]> = {};
  let workspaceAccountManager: WorkspaceAccountManager;
  let activeAccount: Account;

  const fakeGetProject: typeof tryToGetProjectFromInstance = async (
    credentials,
    namespaceWithPath,
  ) => {
    const namespacesWithPath = projects[`${credentials.instanceUrl}-${credentials.token}`];
    return namespacesWithPath?.includes(namespaceWithPath)
      ? ({
          namespaceWithPath,
        } as GitLabProject)
      : undefined;
  };
  const createPointers = (remotes: [string, string, string?][]) => {
    const repository = createFakeRepository({ remotes });
    const gitRepository = new GitRepositoryImpl(repository);
    return createRemoteUrlPointers(gitRepository);
  };
  beforeEach(() => {
    projects = {};
    activeAccount = createOAuthAccount();
    workspaceAccountManager = createFakePartial<WorkspaceAccountManager>({
      get activeAccount() {
        return activeAccount;
      },
      onChange: jest.fn(),
    });
  });
  describe('initializeAllProjects', () => {
    const defaultAccount = createTokenAccount('https://gitlab.com', 1, 'abc');
    const extensionRemoteUrl = 'git@gitlab.com/gitlab-org/gitlab-vscode-extension';

    describe('with one project on the GitLab instance', () => {
      beforeEach(() => {
        projects = { 'https://gitlab.com-abc': ['gitlab-org/gitlab-vscode-extension'] };
      });

      it('initializes the simple scenario when there is one remote in one repo matching credentials', async () => {
        const pointers = createPointers([['origin', extensionRemoteUrl]]);

        const initializedProjects = await initializeAllProjects(
          defaultAccount,
          pointers,
          [],
          fakeGetProject,
        );

        expect(initializedProjects).toHaveLength(1);
        const [projectAndRepo] = initializedProjects;
        expect(projectAndRepo.account).toEqual(defaultAccount);
        expect(projectAndRepo.project.namespaceWithPath).toEqual(
          'gitlab-org/gitlab-vscode-extension',
        );
        expect(projectAndRepo.pointer).toEqual(pointers[0]);
        expect(projectAndRepo.initializationType).toBeUndefined();
      });

      it('initializes only projects present on the GitLab instance', async () => {
        const securityRemoteUrl = 'git@gitlab.com/gitlab-org/security/gitlab-vscode-extension';
        const pointers = createPointers([
          ['origin', extensionRemoteUrl],
          ['security', securityRemoteUrl],
        ]);

        const initializedProjects = await initializeAllProjects(
          defaultAccount,
          pointers,
          [],
          fakeGetProject,
        );

        expect(initializedProjects).toHaveLength(1);
      });

      it('can manually assign GitLab project to a remote URL', async () => {
        const pointers = createPointers([['origin', 'remote:that-we-cannot-parse-automatically']]);
        const selectedProjectSetting: SelectedProjectSetting = {
          accountId: defaultAccount.id,
          namespaceWithPath: 'gitlab-org/gitlab-vscode-extension',
          remoteName: 'origin',
          remoteUrl: 'remote:that-we-cannot-parse-automatically',
          repositoryRootPath: pointers[0].repository.rootFsPath,
        };

        const initializedProjects = await initializeAllProjects(
          defaultAccount,
          pointers,
          [selectedProjectSetting],
          fakeGetProject,
        );

        expect(initializedProjects).toHaveLength(1);
      });
    });

    describe('with two projects in one repository', () => {
      const securityRemoteUrl = 'git@gitlab.com/gitlab-org/security/gitlab-vscode-extension';
      const pointers = createPointers([
        ['origin', extensionRemoteUrl],
        ['security', securityRemoteUrl],
      ]);
      beforeEach(() => {
        projects = {
          'https://gitlab.com-abc': [
            'gitlab-org/gitlab-vscode-extension',
            'gitlab-org/security/gitlab-vscode-extension',
          ],
          'https://gitlab.com-def': ['gitlab-org/gitlab-vscode-extension'],
        };
      });

      it('initializes two detected projects in one repo', async () => {
        const initializedProjects = await initializeAllProjects(
          defaultAccount,
          pointers,
          [],
          fakeGetProject,
        );

        expect(initializedProjects).toHaveLength(2);
        const [origin, security] = initializedProjects;
        expect(origin.project.namespaceWithPath).toBe('gitlab-org/gitlab-vscode-extension');
        expect(security.project.namespaceWithPath).toBe(
          'gitlab-org/security/gitlab-vscode-extension',
        );
      });

      it('marks repo as selected if it was selected by the user', async () => {
        const selectedProjectSetting: SelectedProjectSetting = {
          accountId: defaultAccount.id,
          namespaceWithPath: 'gitlab-org/gitlab-vscode-extension',
          remoteName: 'origin',
          remoteUrl: extensionRemoteUrl,
          repositoryRootPath: pointers[0].repository.rootFsPath,
        };

        const initializedProjects = await initializeAllProjects(
          defaultAccount,
          pointers,
          [selectedProjectSetting],
          fakeGetProject,
        );

        expect(initializedProjects).toHaveLength(2);
        const [origin, security] = initializedProjects;
        expect(origin.initializationType).toBe('selected');
        expect(security.initializationType).toBeUndefined();
      });

      it('uses account ID to match the selected project', async () => {
        const secondAccount = createTokenAccount(defaultAccount.instanceUrl, 10, 'def');
        const selectedProjectSetting: SelectedProjectSetting = {
          accountId: secondAccount.id,
          namespaceWithPath: 'gitlab-org/gitlab-vscode-extension',
          remoteName: 'origin',
          remoteUrl: extensionRemoteUrl,
          repositoryRootPath: pointers[0].repository.rootFsPath,
        };

        const initializedProjects = await initializeAllProjects(
          secondAccount,
          pointers,
          [selectedProjectSetting],
          fakeGetProject,
        );

        const [origin] = initializedProjects;
        expect(origin.initializationType).toBe('selected');
        expect(origin.account).toEqual(secondAccount);
      });
    });

    describe('when the setting cannot be loaded into a project', () => {
      const pointers = createPointers([['origin', extensionRemoteUrl]]);
      const correctSetting: SelectedProjectSetting = {
        accountId: defaultAccount.id,
        namespaceWithPath: 'gitlab-org/gitlab-vscode-extension',
        remoteName: 'origin',
        remoteUrl: extensionRemoteUrl,
        repositoryRootPath: pointers[0].repository.rootFsPath,
      };

      const initializeProjectsWithSetting = async (setting: Partial<SelectedProjectSetting>) =>
        initializeAllProjects(
          defaultAccount,
          pointers,
          [{ ...correctSetting, ...setting }],
          fakeGetProject,
        );

      beforeEach(() => {
        projects = {
          'https://gitlab.com-abc': ['gitlab-org/gitlab-vscode-extension'],
        };
      });

      it('falls back to detected project', async () => {
        const initializedProjects = await initializeProjectsWithSetting({
          namespaceWithPath: 'aa',
        });
        expect(initializedProjects[0]?.project.namespaceWithPath).toBe(
          'gitlab-org/gitlab-vscode-extension',
        );
      });

      it('logs an issue when the remote does not exist', async () => {
        await initializeProjectsWithSetting({ remoteName: 'nonexistent' });

        expect(jest.mocked(log.warn).mock.calls[0][0]).toMatch(
          /unable to find remote nonexistent/i,
        );
      });

      it('logs an issue when credentials do not exist', async () => {
        await initializeProjectsWithSetting({ accountId: 'nonexistent' });

        expect(jest.mocked(log.warn).mock.calls[0][0]).toMatch(
          /unable to find credentials for account nonexistent/i,
        );
      });

      it('logs an issue when project cannot be fetched', async () => {
        await initializeProjectsWithSetting({ namespaceWithPath: 'nonexistent' });

        expect(jest.mocked(log.warn).mock.calls[0][0]).toMatch(
          /unable to fetch selected project nonexistent/i,
        );
      });
    });
  });
  describe('GitLabProjectRepositoryImpl', () => {
    let repository: GitLabProjectRepositoryImpl;

    beforeEach(() => {
      const fakeAccountService = createFakePartial<AccountService>({
        getAllAccounts: () => [createTokenAccount()],
        onDidChange: jest.fn(),
      });

      const [pointer] = createPointers([
        ['origin', 'git@gitlab.com:gitlab-org/gitlab-vscode-extension'],
      ]);
      const fakeGitWrapper = createFakePartial<GitExtensionWrapper>({
        gitRepositories: [pointer.repository],
        onRepositoryCountChanged: jest.fn(),
      });
      const fakeSettingStore = createFakePartial<SelectedProjectStore>({
        selectedProjectSettings: [],
        onSelectedProjectsChange: jest.fn(),
      });
      jest.mocked(tryToGetProjectFromInstance).mockImplementation(fakeGetProject);
      projects = {
        'https://gitlab.com-abc': ['gitlab-org/gitlab-vscode-extension'],
      };
      repository = new GitLabProjectRepositoryImpl(
        fakeAccountService,
        fakeGitWrapper,
        fakeSettingStore,
        workspaceAccountManager,
      );
    });

    it('initializes single account with single account', async () => {
      await repository.init();
      const [project] = repository.getDefaultAndSelectedProjects();
      expect(project.account).toBe(activeAccount);
    });
  });
});
