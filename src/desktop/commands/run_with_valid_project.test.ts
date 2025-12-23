import vscode, { Tab, WorkspaceFolder } from 'vscode';
import { asMutable } from '../../common/test_utils/types';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { toMergedYamlUri } from '../ci/merged_yaml_uri';
import { toJobLogUri } from '../ci/job_log_uri';
import { getProjectRepository, GitLabProjectRepository } from '../gitlab/gitlab_project_repository';
import { createTokenAccount, gitRepository, projectInRepository } from '../test_utils/entities';
import { project } from '../../common/test_utils/entities';
import { gitExtensionWrapper } from '../git/git_extension_wrapper';
import { createFakeRepository } from '../test_utils/fake_git_extension';
import { GitRemote, GitRepository } from '../git/new_git';
import { ProjectInRepository } from '../gitlab/new_project';
import {
  getActiveProject,
  getRepositoryRootForUri,
  runWithValidProject,
} from './run_with_valid_project';

jest.mock('../gitlab/gitlab_project_repository');
jest.mock('../../common/utils/extension_configuration');
jest.mock('../../common/log');
jest.mock('../git/git_extension_wrapper');

describe('runWithValidProject', () => {
  describe('with valid project', () => {
    beforeEach(() => {
      jest.mocked(getProjectRepository).mockReturnValue(
        createFakePartial<GitLabProjectRepository>({
          getDefaultAndSelectedProjects: jest.fn().mockReturnValue([projectInRepository]),
          getSelectedOrDefaultForRepository: jest.fn().mockReturnValue(projectInRepository),
        }),
      );
    });

    it('injects repository, remote, and GitLab project into the command', async () => {
      const command = jest.fn();

      await runWithValidProject(command)();

      expect(command).toHaveBeenCalledWith(projectInRepository);
    });

    describe('getRepositoryRootForUri', () => {
      it('returns the root for Job Log uri', () => {
        const uri = toJobLogUri('repository root', 1, 1);
        const root = getRepositoryRootForUri(uri);
        expect(root).toEqual('repository root');
      });
      it('returns the root for Merged YAML uri', () => {
        const uri = toMergedYamlUri({
          repositoryRoot: 'repository root',
          path: 'path',
          initial: 'initial',
        });
        const root = getRepositoryRootForUri(uri);
        expect(root).toEqual('repository root');
      });
    });

    describe('getActiveProject', () => {
      afterEach(() => {
        jest.resetAllMocks();
        asMutable(vscode.window.tabGroups.activeTabGroup).activeTab = undefined;
        asMutable(vscode.workspace).workspaceFolders = [];
      });
      it('returns project of active file in the editor', () => {
        const activeFileUri = vscode.Uri.file('/path/to/file1.ts');
        // set active file
        asMutable(vscode.window.tabGroups.activeTabGroup).activeTab = createFakePartial<Tab>(
          createFakePartial<vscode.Tab>({
            input: new vscode.TabInputText(activeFileUri),
          }),
        );
        jest.mocked(gitExtensionWrapper.getRepositoryForFile).mockReturnValue(gitRepository);

        const activeProject = getActiveProject();

        expect(gitExtensionWrapper.getRepositoryForFile).toHaveBeenCalledWith(activeFileUri);
        expect(activeProject).toBe(projectInRepository);
      });

      it("returns project if it's single repository in workspace with no active file", () => {
        const activeProject = getActiveProject();
        expect(getProjectRepository().getSelectedOrDefaultForRepository).not.toHaveBeenCalled();
        expect(getProjectRepository().getDefaultAndSelectedProjects).toHaveBeenCalled();
        expect(activeProject).toBe(projectInRepository);
      });

      it("returns workspace folder project if it's single-folder workspace with multi-repositories", () => {
        const gitRepository2 = {
          rootFsPath: '/path/to/test-repo',
          rawRepository: createFakeRepository(),
        } as GitRepository;
        const projectInRepository2: ProjectInRepository = {
          project,
          pointer: {
            repository: gitRepository2,
            remote: { name: 'name' } as GitRemote,
            urlEntry: { type: 'both', url: 'git@gitlab.com:gitlab-org/test-repo' },
          },
          account: createTokenAccount(),
        };

        jest.mocked(getProjectRepository).mockReturnValue(
          createFakePartial<GitLabProjectRepository>({
            getDefaultAndSelectedProjects: jest
              .fn()
              .mockReturnValue([projectInRepository, projectInRepository2]),
            getSelectedOrDefaultForRepository: jest.fn().mockReturnValue(projectInRepository2),
          }),
        );

        // mock a single-folder workspace
        asMutable(vscode.workspace).workspaceFolders = [
          createFakePartial<WorkspaceFolder>({
            uri: vscode.Uri.file('/path/to/test-repo'),
            name: 'name',
          }),
        ];
        jest.mocked(gitExtensionWrapper.getRepositoryForFile).mockReturnValue(gitRepository2);

        const activeProject = getActiveProject();

        expect(getProjectRepository().getSelectedOrDefaultForRepository).toHaveBeenCalledTimes(1);
        expect(getProjectRepository().getSelectedOrDefaultForRepository).toHaveBeenCalledWith(
          '/path/to/test-repo',
        );

        expect(gitExtensionWrapper.getRepositoryForFile).toHaveBeenCalledWith(
          vscode.Uri.file('/path/to/test-repo'),
        );

        expect(activeProject).toBe(projectInRepository2);
      });

      it('returns undefined if there is multiple repositories and no active file', () => {
        const projectInRepository2: ProjectInRepository = {
          project,
          pointer: {
            repository: {
              rootFsPath: '/path/to/test-repo',
              rawRepository: createFakeRepository(),
            } as GitRepository,
            remote: { name: 'name' } as GitRemote,
            urlEntry: { type: 'both', url: 'git@gitlab.com:gitlab-org/test-repo' },
          },
          account: createTokenAccount(),
        };
        jest.mocked(getProjectRepository).mockReturnValue(
          createFakePartial<GitLabProjectRepository>({
            getDefaultAndSelectedProjects: jest
              .fn()
              .mockReturnValue([projectInRepository, projectInRepository2]),
          }),
        );
        const activeProject = getActiveProject();
        expect(activeProject).toBe(undefined);
      });
    });
  });

  describe('without project', () => {
    beforeEach(() => {
      jest.mocked(getProjectRepository).mockReturnValue(
        createFakePartial<GitLabProjectRepository>({
          getDefaultAndSelectedProjects: jest.fn().mockReturnValue([]),
        }),
      );
    });

    it('does not run the command', async () => {
      const command = jest.fn();

      await runWithValidProject(command)();

      expect(command).not.toHaveBeenCalled();
    });
  });
});
