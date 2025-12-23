import {
  GetRepositoriesResponse,
  RepositoryState,
  SingleProjectRepository,
  SelectProjectParams,
  ClearProjectParams,
  RepositoryEndpoints,
  GitRemoteUrlPointer,
} from '@gitlab-org/gitlab-lsp';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { log } from '../log';
import { RepositoryClientImpl } from './repository_client';

jest.mock('../log');

describe('RepositoryClient', () => {
  let mockSendRequest: jest.Mock;
  let repositoryClient: RepositoryClientImpl;

  const mockRepository = createFakePartial<SingleProjectRepository>({
    type: 'single',
    repository: {
      rootFsPath: '/path/to/repo',
      folderName: 'test-repo',
    },
  });

  const mockRepositories: RepositoryState[] = [mockRepository];

  const mockSelectProjectParams = createFakePartial<SelectProjectParams>({
    project: {
      name: 'test-project',
      namespaceWithPath: 'namespace/test-project',
      webUrl: 'https://gitlab.com/namespace/test-project',
    },
    pointer: {
      repository: {
        rootFsPath: '/path/to/repo',
      },
    } as GitRemoteUrlPointer,
    initializationType: 'detected',
  });

  const mockClearProjectParams: ClearProjectParams = {
    rootFsPath: '/path/to/repo',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendRequest = jest.fn();
    repositoryClient = new RepositoryClientImpl();
    repositoryClient.setRequestFunction(mockSendRequest);
  });

  describe('setRequestFunction', () => {
    it('should set the request function', () => {
      const newMockSendRequest = jest.fn();
      repositoryClient.setRequestFunction(newMockSendRequest);
      expect(() => repositoryClient.setRequestFunction(newMockSendRequest)).not.toThrow();
    });
  });

  describe('getRepositories', () => {
    it('should return cached repositories if available', async () => {
      repositoryClient.handleRepositoriesChanged({ repositories: mockRepositories });

      const result = await repositoryClient.getRepositories();

      expect(result).toEqual(mockRepositories);
      expect(mockSendRequest).not.toHaveBeenCalled();
    });

    it('should fetch repositories from language server if cache is empty', async () => {
      const mockResponse: GetRepositoriesResponse = {
        repositories: mockRepositories,
      };
      mockSendRequest.mockResolvedValue(mockResponse);

      const result = await repositoryClient.getRepositories();

      expect(mockSendRequest).toHaveBeenCalledWith(RepositoryEndpoints.GET_REPOSITORIES);
      expect(result).toEqual(mockRepositories);
    });

    it('should return empty array if language server request fails', async () => {
      mockSendRequest.mockRejectedValue(new Error('Request failed'));

      const result = await repositoryClient.getRepositories();

      expect(result).toEqual([]);
    });

    it('should cache repositories after successful request', async () => {
      const mockResponse: GetRepositoriesResponse = {
        repositories: mockRepositories,
      };
      mockSendRequest.mockResolvedValue(mockResponse);

      // First call should make request
      await repositoryClient.getRepositories();
      expect(mockSendRequest).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result = await repositoryClient.getRepositories();
      expect(mockSendRequest).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRepositories);
    });

    it('should return empty array if request function is not set', async () => {
      const newRepositoryClient = new RepositoryClientImpl();

      const result = await newRepositoryClient.getRepositories();

      expect(result).toEqual([]);
    });
  });

  describe('selectProject', () => {
    it('should call sendRequest with correct parameters', async () => {
      mockSendRequest.mockResolvedValue(undefined);

      await repositoryClient.selectProject(mockSelectProjectParams);

      expect(mockSendRequest).toHaveBeenCalledWith(
        RepositoryEndpoints.SELECT_PROJECT,
        mockSelectProjectParams,
      );
    });

    it('should log success message when project is selected', async () => {
      mockSendRequest.mockResolvedValue(undefined);

      await repositoryClient.selectProject(mockSelectProjectParams);

      expect(log.info).toHaveBeenCalledWith(
        'Selected project namespace/test-project for repository /path/to/repo',
      );
    });

    it('should log warning and return early if request function is not set', async () => {
      const newRepositoryClient = new RepositoryClientImpl();

      await newRepositoryClient.selectProject(mockSelectProjectParams);

      expect(log.warn).toHaveBeenCalledWith(
        'Repository client not initialized with request function',
      );
      expect(mockSendRequest).not.toHaveBeenCalled();
    });

    it('should log error and rethrow when request fails', async () => {
      const error = new Error('Failed to select project');
      mockSendRequest.mockRejectedValue(error);

      await expect(repositoryClient.selectProject(mockSelectProjectParams)).rejects.toThrow(error);

      expect(log.error).toHaveBeenCalledWith('Failed to select project:', error);
    });
  });

  describe('clearSelectedProjects', () => {
    it('should call sendRequest with correct parameters', async () => {
      mockSendRequest.mockResolvedValue(undefined);

      await repositoryClient.clearSelectedProjects(mockClearProjectParams);

      expect(mockSendRequest).toHaveBeenCalledWith(
        RepositoryEndpoints.CLEAR_PROJECT,
        mockClearProjectParams,
      );
    });

    it('should log success message when projects are cleared', async () => {
      mockSendRequest.mockResolvedValue(undefined);

      await repositoryClient.clearSelectedProjects(mockClearProjectParams);

      expect(log.info).toHaveBeenCalledWith(
        'Cleared selected projects for repository /path/to/repo',
      );
    });

    it('should log warning and return early if request function is not set', async () => {
      const newRepositoryClient = new RepositoryClientImpl();

      await newRepositoryClient.clearSelectedProjects(mockClearProjectParams);

      expect(log.warn).toHaveBeenCalledWith(
        'Repository client not initialized with request function',
      );
      expect(mockSendRequest).not.toHaveBeenCalled();
    });

    it('should log error and rethrow when request fails', async () => {
      const error = new Error('Failed to clear projects');
      mockSendRequest.mockRejectedValue(error);

      await expect(repositoryClient.clearSelectedProjects(mockClearProjectParams)).rejects.toThrow(
        error,
      );

      expect(log.error).toHaveBeenCalledWith('Failed to clear selected projects:', error);
    });
  });

  describe('handleRepositoriesChanged', () => {
    it('should emit event when repositories change', () => {
      const listener = jest.fn();
      repositoryClient.onRepositoriesChanged(listener);

      repositoryClient.handleRepositoriesChanged({ repositories: mockRepositories });

      expect(listener).toHaveBeenCalledWith(mockRepositories);
    });

    it('should update cached repositories when notification is received', async () => {
      const newRepository: SingleProjectRepository = {
        ...mockRepository,
        repository: {
          ...mockRepository.repository,
          rootFsPath: '/path/to/new-repo',
          folderName: 'new-repo',
        },
      };
      const newRepositories: RepositoryState[] = [newRepository];

      repositoryClient.handleRepositoriesChanged({ repositories: newRepositories });

      const result = await repositoryClient.getRepositories();
      expect(result).toEqual(newRepositories);
      expect(mockSendRequest).not.toHaveBeenCalled();
    });

    it('should not emit duplicate events for same repositories', () => {
      const listener = jest.fn();
      repositoryClient.onRepositoriesChanged(listener);

      // First notification
      repositoryClient.handleRepositoriesChanged({ repositories: mockRepositories });
      expect(listener).toHaveBeenCalledTimes(1);

      // Same repositories - should not emit again due to diffEmitter
      repositoryClient.handleRepositoriesChanged({ repositories: mockRepositories });
      expect(listener).toHaveBeenCalledTimes(1);

      // Different repositories - should emit
      const differentRepository: SingleProjectRepository = {
        ...mockRepository,
        repository: {
          ...mockRepository.repository,
          rootFsPath: '/different/path',
        },
      };
      const differentRepositories = [differentRepository];

      repositoryClient.handleRepositoriesChanged({ repositories: differentRepositories });
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });
});
