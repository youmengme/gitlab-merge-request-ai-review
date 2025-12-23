import * as vscode from 'vscode';
import { MultipleProjectRepository, GitRemoteUrlPointer } from '@gitlab-org/gitlab-lsp';
import { RepositoryClient } from '../../common/language_server/repository_client';
import { MultipleProjectsItem } from '../tree_view/items/multiple_projects_item';
import { ProjectItemModel } from '../tree_view/items/project_item_model';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { GitRepository } from '../git/new_git';
import { lsSelectProjectCommand, lsClearSelectedProjects } from './ls_select_project';

describe('Select Project (LS implementation)', () => {
  let mockRepositoryClient: RepositoryClient;
  let mockMultipleProjectsItem: MultipleProjectsItem;
  let mockRepository: GitRepository;

  const mockProjectData = {
    project: {
      name: 'test-project',
      namespaceWithPath: 'namespace/test-project',
      webUrl: 'https://gitlab.com/namespace/test-project',
    },
    account: {
      id: 'account-1',
      username: 'testuser',
      restId: 123,
      instanceUrl: 'https://gitlab.com',
    },
    pointer: {} as GitRemoteUrlPointer,
    initializationType: 'detected' as const,
  };

  const mockRepositoryState = createFakePartial<MultipleProjectRepository>({
    projects: [mockProjectData],
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepositoryClient = createFakePartial<RepositoryClient>({
      selectProject: jest.fn(),
      clearSelectedProjects: jest.fn(),
    });

    mockRepository = createFakePartial<GitRepository>({
      rootFsPath: '/path/to/repo',
    });

    mockMultipleProjectsItem = new MultipleProjectsItem(mockRepository, mockRepositoryState);
  });

  describe('lsSelectProjectCommand', () => {
    it('should show quick pick when called', async () => {
      jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

      await lsSelectProjectCommand(mockMultipleProjectsItem, mockRepositoryClient);

      expect(vscode.window.showQuickPick).toHaveBeenCalled();
    });

    it('should return early when user cancels selection', async () => {
      jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

      await lsSelectProjectCommand(mockMultipleProjectsItem, mockRepositoryClient);

      expect(mockRepositoryClient.selectProject).not.toHaveBeenCalled();
    });

    it('should show detected projects when repository state has projects', async () => {
      const selectedOption = {
        label: 'namespace/test-project',
        description: 'detected',
        detail: 'https://gitlab.com (testuser)',
        isOther: false,
        projectData: mockProjectData,
      };

      jest.mocked(vscode.window.showQuickPick).mockResolvedValue(selectedOption);

      await lsSelectProjectCommand(
        mockMultipleProjectsItem,
        mockRepositoryClient,
        mockRepositoryState,
      );

      expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: 'namespace/test-project',
            description: 'detected',
            detail: 'https://gitlab.com (testuser)',
            isOther: false,
          }),
          expect.objectContaining({
            label: 'Manually assign GitLab project to repository',
            detail: 'Select this option if your Git remote URL does not follow a standard format',
            isOther: true,
          }),
        ]),
        { title: 'Select GitLab Project' },
      );
    });

    it('should show only manual assignment option when no projects detected', async () => {
      const selectedOption = {
        label: 'Manually assign GitLab project to repository',
        detail: 'Select this option if your Git remote URL does not follow a standard format',
        isOther: true,
      };

      jest.mocked(vscode.window.showQuickPick).mockResolvedValue(selectedOption);

      await lsSelectProjectCommand(mockMultipleProjectsItem, mockRepositoryClient);

      expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
        [
          {
            label: 'Manually assign GitLab project to repository',
            detail: 'Select this option if your Git remote URL does not follow a standard format',
            isOther: true,
          },
        ],
        { title: 'Select GitLab Project' },
      );
    });

    it('should call selectProject when a detected project is selected', async () => {
      const selectedOption = {
        label: 'namespace/test-project',
        description: 'detected',
        detail: 'https://gitlab.com (testuser)',
        isOther: false,
        projectData: mockProjectData,
      };

      jest.mocked(vscode.window.showQuickPick).mockResolvedValue(selectedOption);

      await lsSelectProjectCommand(
        mockMultipleProjectsItem,
        mockRepositoryClient,
        mockRepositoryState,
      );

      expect(mockRepositoryClient.selectProject).toHaveBeenCalledWith(mockProjectData);
    });

    it('should handle selectProject errors gracefully', async () => {
      const selectedOption = {
        label: 'namespace/test-project',
        description: 'detected',
        detail: 'https://gitlab.com (testuser)',
        isOther: false,
        projectData: mockProjectData,
      };

      const error = new Error('Failed to select project');
      jest.mocked(vscode.window.showQuickPick).mockResolvedValue(selectedOption);
      jest.mocked(mockRepositoryClient.selectProject).mockRejectedValue(error);

      await lsSelectProjectCommand(
        mockMultipleProjectsItem,
        mockRepositoryClient,
        mockRepositoryState,
      );

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to select project: Failed to select project',
      );
    });

    it('should handle non-Error exceptions', async () => {
      const selectedOption = {
        label: 'namespace/test-project',
        description: 'detected',
        detail: 'https://gitlab.com (testuser)',
        isOther: false,
        projectData: mockProjectData,
      };

      jest.mocked(vscode.window.showQuickPick).mockResolvedValue(selectedOption);
      jest.mocked(mockRepositoryClient.selectProject).mockRejectedValue('String error');

      await lsSelectProjectCommand(
        mockMultipleProjectsItem,
        mockRepositoryClient,
        mockRepositoryState,
      );

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to select project: Unknown error',
      );
    });

    it('should return early when manual assignment is selected (TODO implementation)', async () => {
      const selectedOption = {
        label: 'Manually Assign GitLab Project to Repository',
        detail: 'Use this to assign a GitLab project to this repository.',
        isOther: true,
      };

      jest.mocked(vscode.window.showQuickPick).mockResolvedValue(selectedOption);

      await lsSelectProjectCommand(mockMultipleProjectsItem, mockRepositoryClient);

      expect(mockRepositoryClient.selectProject).not.toHaveBeenCalled();
    });
  });

  describe('lsClearSelectedProjects', () => {
    let mockProjectItemModel: ProjectItemModel;

    beforeEach(() => {
      mockProjectItemModel = createFakePartial<ProjectItemModel>({
        projectInRepository: {
          pointer: {
            repository: {
              rootFsPath: '/path/to/repo',
            },
          },
        },
      });
    });

    it('should call clearSelectedProjects with correct parameters', async () => {
      await lsClearSelectedProjects(mockProjectItemModel, mockRepositoryClient);

      expect(mockRepositoryClient.clearSelectedProjects).toHaveBeenCalledWith({
        rootFsPath: '/path/to/repo',
      });
    });

    it('should show success message when clearing projects succeeds', async () => {
      await lsClearSelectedProjects(mockProjectItemModel, mockRepositoryClient);

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Cleared selected projects for repository /path/to/repo',
      );
    });

    it('should handle clearSelectedProjects errors gracefully', async () => {
      const error = new Error('Failed to clear projects');
      jest.mocked(mockRepositoryClient.clearSelectedProjects).mockRejectedValue(error);

      await lsClearSelectedProjects(mockProjectItemModel, mockRepositoryClient);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to clear selected projects: Failed to clear projects',
      );
    });

    it('should handle non-Error exceptions when clearing projects', async () => {
      jest.mocked(mockRepositoryClient.clearSelectedProjects).mockRejectedValue('String error');

      await lsClearSelectedProjects(mockProjectItemModel, mockRepositoryClient);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to clear selected projects: Unknown error',
      );
    });
  });
});
