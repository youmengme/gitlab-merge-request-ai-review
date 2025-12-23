import {
  SingleProjectRepository,
  SelectedProjectRepository,
  MultipleProjectRepository,
  RepositoryWithoutProject,
  RepositoryState,
} from '@gitlab-org/gitlab-lsp';
import { expect } from '@jest/globals';
import { GitExtensionWrapper } from '../git/git_extension_wrapper';
import { GitRepository } from '../git/new_git';
import { AccountService } from '../accounts/account_service';
import { RepositoryClient } from '../../common/language_server/repository_client';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { RepositoryStateTranslator } from './repository_state_translator';

describe('RepositoryStateTranslator', () => {
  let translator: RepositoryStateTranslator;
  let mockGitExtensionWrapper: GitExtensionWrapper;
  let mockAccountService: AccountService;
  let mockRepositoryClient: RepositoryClient;
  let mockGitRepository: GitRepository;

  beforeEach(() => {
    mockGitRepository = createFakePartial<GitRepository>({
      rootFsPath: '/test/repo',
      remotes: [
        {
          name: 'origin',
          urlEntries: [
            {
              url: 'git@gitlab.com:test/repo.git',
              type: 'both',
            },
          ],
        },
      ],
    });

    mockGitExtensionWrapper = createFakePartial<GitExtensionWrapper>({
      gitRepositories: [mockGitRepository],
    });

    mockAccountService = createFakePartial<AccountService>({
      getAccount: jest.fn().mockReturnValue(
        createFakePartial({
          id: 'https://gitlab.com:123',
          instanceUrl: 'https://gitlab.com',
          restId: 123,
        }),
      ),
    });

    mockRepositoryClient = createFakePartial<RepositoryClient>({
      onRepositoriesChanged: jest.fn(),
      getRepositories: jest.fn(),
      setRequestFunction: jest.fn(),
      handleRepositoriesChanged: jest.fn(),
    });

    translator = new RepositoryStateTranslator(
      mockGitExtensionWrapper,
      mockAccountService,
      mockRepositoryClient,
    );
  });

  describe('translateToProjectInRepository', () => {
    it('should translate SingleProjectRepository to ProjectInRepository', () => {
      const repositoryState = createFakePartial<SingleProjectRepository>({
        type: 'single',
        repository: {
          rootFsPath: '/test/repo',
          folderName: 'repo',
        },
        selectedProject: {
          account: {
            restId: 123,
            instanceUrl: 'https://gitlab.com',
          },
          pointer: {
            remote: {
              name: 'origin',
            },
            urlEntry: {
              url: 'git@gitlab.com:test/repo.git',
              type: 'both',
            },
          },
        },
      });

      const result = translator.translateToProjectInRepository(repositoryState);

      expect(result).toBeDefined();
      expect(result?.initializationType).toBe('selected');
    });

    it('should translate SelectedProjectRepository to ProjectInRepository', () => {
      const repositoryState = createFakePartial<SelectedProjectRepository>({
        type: 'selected',
        repository: {
          rootFsPath: '/test/repo',
          folderName: 'repo',
        },
        selectedProject: {
          account: {
            restId: 123,
            instanceUrl: 'https://gitlab.com',
          },
          pointer: {
            remote: {
              name: 'origin',
            },
            urlEntry: {
              url: 'git@gitlab.com:test/repo.git',
              type: 'both',
            },
          },
        },
      });

      const result = translator.translateToProjectInRepository(repositoryState);

      expect(result).toBeDefined();
      expect(result?.initializationType).toBe('selected');
    });

    it('should return undefined for MultipleProjectRepository', () => {
      const repositoryState = createFakePartial<MultipleProjectRepository>({
        type: 'multiple',
      });

      const result = translator.translateToProjectInRepository(repositoryState);

      expect(result).toBeUndefined();
    });

    it('should return undefined for RepositoryWithoutProject', () => {
      const repositoryState = createFakePartial<RepositoryWithoutProject>({
        type: 'none',
      });

      const result = translator.translateToProjectInRepository(repositoryState);

      expect(result).toBeUndefined();
    });

    it('should return undefined when GitRepository is not found', () => {
      const repositoryState = createFakePartial<SingleProjectRepository>({
        type: 'single',
        repository: {
          rootFsPath: '/different/repo',
          folderName: 'different-repo',
        },
      });

      const result = translator.translateToProjectInRepository(repositoryState);

      expect(result).toBeUndefined();
    });

    it('should create fallback remote when remote is not found in git repository', () => {
      // Mock a git repository with different remote name
      const mockGitRepoWithDifferentRemote = createFakePartial<GitRepository>({
        rootFsPath: '/test/repo',
        remotes: [
          {
            name: 'upstream',
            urlEntries: [
              {
                url: 'git@gitlab.com:test/repo.git',
                type: 'both',
              },
            ],
          },
        ],
      });

      const mockGitExtensionWrapperWithDifferentRemote = createFakePartial<GitExtensionWrapper>({
        gitRepositories: [mockGitRepoWithDifferentRemote],
      });

      const translatorWithDifferentRemote = new RepositoryStateTranslator(
        mockGitExtensionWrapperWithDifferentRemote,
        mockAccountService,
        mockRepositoryClient,
      );

      const repositoryState = createFakePartial<SingleProjectRepository>({
        type: 'single',
        repository: {
          rootFsPath: '/test/repo',
          folderName: 'repo',
        },
        selectedProject: {
          account: {
            restId: 123,
            instanceUrl: 'https://gitlab.com',
          },
          pointer: {
            remote: {
              name: 'origin', // This won't match 'upstream' in the mock git repo
              urls: [
                {
                  url: 'git@gitlab.com:test/repo.git',
                  type: 'both',
                },
              ],
            },
            urlEntry: {
              url: 'git@gitlab.com:test/repo.git',
              type: 'both',
            },
          },
        },
      });

      const result = translatorWithDifferentRemote.translateToProjectInRepository(repositoryState);

      expect(result).toBeDefined();
      expect(result?.pointer.remote.name).toBe('origin'); // Should use the fallback remote
      expect(result?.pointer.remote.urlEntries).toEqual([
        {
          url: 'git@gitlab.com:test/repo.git',
          type: 'both',
        },
      ]);
    });
  });

  describe('onRepositoriesChanged', () => {
    it('should register a callback for repository state changes', () => {
      const mockOnRepositoriesChanged = jest.fn().mockReturnValue({ dispose: jest.fn() });
      jest
        .mocked(mockRepositoryClient.onRepositoriesChanged)
        .mockImplementation(mockOnRepositoriesChanged);

      const callback = jest.fn();
      translator.onRepositoriesChanged(callback);

      expect(mockOnRepositoriesChanged).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should call callback with translated projects when repositories change', () => {
      let repositoryChangeHandler: (states: RepositoryState[]) => void = () => {};
      jest.mocked(mockRepositoryClient.onRepositoriesChanged).mockImplementation(handler => {
        repositoryChangeHandler = handler;
        return { dispose: jest.fn() };
      });

      const callback = jest.fn();
      translator.onRepositoriesChanged(callback);

      const repositoryStates: RepositoryState[] = [
        createFakePartial<SingleProjectRepository>({
          type: 'single',
          repository: {
            rootFsPath: '/test/repo',
            folderName: 'repo',
          },
          selectedProject: {
            account: {
              restId: 123,
              instanceUrl: 'https://gitlab.com',
            },
            pointer: {
              remote: {
                name: 'origin',
              },
              urlEntry: {
                url: 'git@gitlab.com:test/repo.git',
                type: 'both',
              },
            },
          },
        }),
        createFakePartial<MultipleProjectRepository>({
          type: 'multiple',
        }),
      ];

      repositoryChangeHandler(repositoryStates);

      // Should only call callback with successfully translated projects (single project, not multiple)
      expect(callback).toHaveBeenCalledWith([
        expect.objectContaining({
          initializationType: 'selected',
          pointer: expect.objectContaining({
            repository: expect.objectContaining({
              rootFsPath: '/test/repo',
            }),
          }),
        }),
      ]);
    });
  });
});
