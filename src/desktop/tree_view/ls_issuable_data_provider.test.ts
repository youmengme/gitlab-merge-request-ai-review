import * as vscode from 'vscode';
import {
  RepositoryWithoutProject,
  SingleProjectRepository,
  MultipleProjectRepository,
  SelectedProjectRepository,
} from '@gitlab-org/gitlab-lsp';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { ExtensionState } from '../extension_state';
import { RepositoryClient } from '../../common/language_server/repository_client';
import {
  ExtensionConfiguration,
  extensionConfigurationService,
} from '../../common/utils/extension_configuration_service';
import { CustomQuery } from '../../common/gitlab/custom_query';
import { CustomQueryType } from '../../common/gitlab/custom_query_type';
import { AccountService } from '../accounts/account_service';
import { GitRepository } from '../git/new_git';
import { ProjectInRepository } from '../gitlab/new_project';
import { LSIssuableDataProvider } from './ls_issuable_data_provider';
import { ProjectItemModel } from './items/project_item_model';
import { MultipleProjectsItem } from './items/multiple_projects_item';
import { NoProjectItem } from './items/no_project_item';
import { ItemModel } from './items/item_model';
import { RepositoryStateTranslator } from './repository_state_translator';

jest.mock('../../common/utils/extension_configuration_service');
jest.mock('./sidebar_view_state', () => ({
  onSidebarViewStateChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
}));
jest.mock('../git/git_extension_wrapper');
jest.mock('./repository_state_translator', () => ({
  RepositoryStateTranslator: jest.fn(),
}));

describe('LSIssuableDataProvider', () => {
  let provider: LSIssuableDataProvider;
  let mockExtensionState: ExtensionState;
  let mockRepositoryClient: RepositoryClient;
  let mockAccountService: AccountService;
  let mockCustomQueries: CustomQuery[];
  let mockTranslator: RepositoryStateTranslator;

  const mockSingleProjectRepository = createFakePartial<SingleProjectRepository>({
    type: 'single',
    repository: {
      rootFsPath: '/path/to/repo',
      folderName: 'test-repo',
    },
  });

  const mockSelectedProjectRepository = createFakePartial<SelectedProjectRepository>({
    type: 'selected',
    repository: {
      rootFsPath: '/path/to/selected-repo',
      folderName: 'selected-repo',
    },
  });

  const mockMultipleProjectsRepository = createFakePartial<MultipleProjectRepository>({
    type: 'multiple',
    repository: {
      rootFsPath: '/path/to/multiple-repo',
      folderName: 'multiple-repo',
    },
  });

  const mockNoProjectRepository = createFakePartial<RepositoryWithoutProject>({
    type: 'none',
    repository: {
      rootFsPath: '/path/to/no-project-repo',
      folderName: 'no-project-repo',
    },
  });

  beforeEach(() => {
    mockCustomQueries = createFakePartial<CustomQuery[]>([
      {
        name: 'Test Query',
        type: CustomQueryType.ISSUE,
        scope: 'all',
        state: 'opened',
        noItemText: 'No issues found',
      },
    ]);

    mockExtensionState = createFakePartial<ExtensionState>({
      isValid: jest.fn().mockReturnValue(true),
      onDidChangeValid: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    });

    mockRepositoryClient = createFakePartial<RepositoryClient>({
      getRepositories: jest.fn(),
      onRepositoriesChanged: jest.fn(),
    });

    mockAccountService = createFakePartial<AccountService>({});

    mockTranslator = createFakePartial<RepositoryStateTranslator>({
      translateToProjectInRepository: jest.fn(),
      mapToGitRepository: jest.fn(),
      onRepositoriesChanged: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    });

    jest.mocked(extensionConfigurationService.getConfiguration).mockReturnValue(
      createFakePartial<ExtensionConfiguration>({
        customQueries: mockCustomQueries,
      }),
    );

    jest.mocked(RepositoryStateTranslator).mockImplementation(() => mockTranslator);

    provider = new LSIssuableDataProvider(
      mockExtensionState,
      mockAccountService,
      mockRepositoryClient,
    );
  });

  afterEach(() => {
    provider.dispose();
  });

  describe('constructor', () => {
    it('should register event listeners', () => {
      expect(mockExtensionState.onDidChangeValid).toHaveBeenCalledWith(provider.refresh, provider);
    });

    it('should create translator with repository client', () => {
      expect(RepositoryStateTranslator).toHaveBeenCalledWith(
        expect.anything(),
        mockAccountService,
        mockRepositoryClient,
      );
    });

    it('should setup repositories change callback', () => {
      expect(mockTranslator.onRepositoriesChanged).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('getChildren', () => {
    it('should return empty array when extension state is invalid', async () => {
      jest.mocked(mockExtensionState.isValid).mockReturnValue(false);

      const result = await provider.getChildren(undefined);

      expect(result).toEqual([]);
      expect(mockRepositoryClient.getRepositories).not.toHaveBeenCalled();
    });

    it('should return empty array when getRepositories fails', async () => {
      jest
        .mocked(mockRepositoryClient.getRepositories)
        .mockRejectedValue(new Error('Failed to get repositories'));

      const result = await provider.getChildren(undefined);

      expect(result).toEqual([]);
    });

    it('should create ProjectItemModel for single project repository', async () => {
      const mockProjectInRepository = createFakePartial<ProjectInRepository>({});
      jest
        .mocked(mockRepositoryClient.getRepositories)
        .mockResolvedValue([mockSingleProjectRepository]);
      jest
        .mocked(mockTranslator.translateToProjectInRepository)
        .mockReturnValue(mockProjectInRepository);

      const result = await provider.getChildren(undefined);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(ProjectItemModel);
      expect(mockTranslator.translateToProjectInRepository).toHaveBeenCalledWith(
        mockSingleProjectRepository,
      );
    });

    it('should create ProjectItemModel for selected project repository', async () => {
      const mockProjectInRepository = createFakePartial<ProjectInRepository>({});
      jest
        .mocked(mockRepositoryClient.getRepositories)
        .mockResolvedValue([mockSelectedProjectRepository]);
      jest
        .mocked(mockTranslator.translateToProjectInRepository)
        .mockReturnValue(mockProjectInRepository);

      const result = await provider.getChildren(undefined);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(ProjectItemModel);
      expect(mockTranslator.translateToProjectInRepository).toHaveBeenCalledWith(
        mockSelectedProjectRepository,
      );
    });

    it('should create MultipleProjectsItem for multiple projects repository', async () => {
      const mockGitRepository = createFakePartial<GitRepository>({
        rootFsPath: '/path/to/multiple-repo',
      });
      jest
        .mocked(mockRepositoryClient.getRepositories)
        .mockResolvedValue([mockMultipleProjectsRepository]);
      jest.mocked(mockTranslator.mapToGitRepository).mockReturnValue(mockGitRepository);

      const result = await provider.getChildren(undefined);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(MultipleProjectsItem);
      expect(mockTranslator.mapToGitRepository).toHaveBeenCalledWith(
        mockMultipleProjectsRepository.repository,
      );
    });

    it('should create NoProjectItem for no project repository', async () => {
      const mockGitRepository = createFakePartial<GitRepository>({
        rootFsPath: '/path/to/no-project-repo',
      });
      jest
        .mocked(mockRepositoryClient.getRepositories)
        .mockResolvedValue([mockNoProjectRepository]);
      jest.mocked(mockTranslator.mapToGitRepository).mockReturnValue(mockGitRepository);

      const result = await provider.getChildren(undefined);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(NoProjectItem);
      expect(mockTranslator.mapToGitRepository).toHaveBeenCalledWith(
        mockNoProjectRepository.repository,
      );
    });

    it('should handle mixed repository types', async () => {
      const mockProjectInRepository = createFakePartial<ProjectInRepository>({});
      const mockGitRepository = createFakePartial<GitRepository>({
        rootFsPath: '/path/to/repo',
      });
      jest
        .mocked(mockRepositoryClient.getRepositories)
        .mockResolvedValue([
          mockSingleProjectRepository,
          mockMultipleProjectsRepository,
          mockNoProjectRepository,
        ]);
      jest
        .mocked(mockTranslator.translateToProjectInRepository)
        .mockReturnValue(mockProjectInRepository);
      jest.mocked(mockTranslator.mapToGitRepository).mockReturnValue(mockGitRepository);

      const result = await provider.getChildren(undefined);

      expect(result).toHaveLength(3);
      expect(result[0]).toBeInstanceOf(ProjectItemModel);
      expect(result[1]).toBeInstanceOf(MultipleProjectsItem);
      expect(result[2]).toBeInstanceOf(NoProjectItem);
    });

    it('should filter out null items when translation fails', async () => {
      jest
        .mocked(mockRepositoryClient.getRepositories)
        .mockResolvedValue([mockSingleProjectRepository]);
      jest.mocked(mockTranslator.translateToProjectInRepository).mockReturnValue(undefined); // Translation fails

      const result = await provider.getChildren(undefined);

      expect(result).toHaveLength(0);
    });

    it('should delegate to child getChildren when element is provided', async () => {
      const mockChild = createFakePartial<ProjectItemModel>({
        getChildren: jest.fn().mockResolvedValue([]),
      });

      const result = await provider.getChildren(mockChild);

      expect(mockChild.getChildren).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('getParent', () => {
    it('should always return null', () => {
      expect(provider.getParent()).toBeNull();
    });
  });

  describe('getTreeItem', () => {
    it('should return tree item from ItemModel', () => {
      const mockTreeItem = new vscode.TreeItem('Test');

      // Create a mock that extends ItemModel
      class MockItemModel extends ItemModel {
        getTreeItem = jest.fn().mockReturnValue(mockTreeItem);

        getChildren = jest.fn().mockResolvedValue([]);
      }

      const mockItemModel = new MockItemModel();
      const result = provider.getTreeItem(mockItemModel);

      expect(mockItemModel.getTreeItem).toHaveBeenCalled();
      expect(result).toBe(mockTreeItem);
    });

    it('should return tree item directly if not ItemModel', () => {
      const mockTreeItem = new vscode.TreeItem('Test');

      const result = provider.getTreeItem(mockTreeItem);

      expect(result).toBe(mockTreeItem);
    });
  });

  describe('refresh', () => {
    it('should fire tree data change event', () => {
      const listener = jest.fn();
      provider.onDidChangeTreeData(listener);

      provider.refresh();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should dispose all subscriptions', () => {
      const mockDispose = jest.fn();
      jest.mocked(mockTranslator.onRepositoriesChanged).mockReturnValue({ dispose: mockDispose });

      const newProvider = new LSIssuableDataProvider(
        mockExtensionState,
        mockAccountService,
        mockRepositoryClient,
      );

      newProvider.dispose();

      expect(mockDispose).toHaveBeenCalled();
    });
  });
});
