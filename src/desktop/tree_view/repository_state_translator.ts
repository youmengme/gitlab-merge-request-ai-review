import { Disposable } from 'vscode';
import {
  RepositoryState,
  SingleProjectRepository,
  SelectedProjectRepository,
} from '@gitlab-org/gitlab-lsp';
import { ProjectInRepository } from '../gitlab/new_project';
import { GitExtensionWrapper } from '../git/git_extension_wrapper';
import { GitRemoteUrlPointer, GitRepository } from '../git/new_git';
import { AccountService } from '../accounts/account_service';
import { RepositoryClient } from '../../common/language_server/repository_client';
import { log } from '../../common/log';
import { GitLabProject } from '../../common/platform/gitlab_project';
import { Account, makeAccountId } from '../../common/platform/gitlab_account';
import { removeTrailingSlash } from '../utils/remove_trailing_slash';

/**
 * Translates Language Server RepositoryState data structures into the legacy
 * ProjectInRepository format used by the existing extension code.
 *
 * This allows for gradual migration from the old GitExtensionWrapper-based
 * approach to the new Language Server-based approach.
 */
export class RepositoryStateTranslator {
  #gitExtensionWrapper: GitExtensionWrapper;

  #accountService: AccountService;

  #repositoryClient: RepositoryClient;

  constructor(
    gitExtensionWrapper: GitExtensionWrapper,
    accountService: AccountService,
    repositoryClient: RepositoryClient,
  ) {
    this.#gitExtensionWrapper = gitExtensionWrapper;
    this.#accountService = accountService;
    this.#repositoryClient = repositoryClient;
  }

  /**
   * Translates a RepositoryState from the Language Server into ProjectInRepository format.
   * Returns undefined if the repository state cannot be translated (e.g., no project, multiple projects).
   */
  translateToProjectInRepository(
    repositoryState: RepositoryState,
  ): ProjectInRepository | undefined {
    switch (repositoryState.type) {
      case 'single':
      case 'selected':
        return this.#translateProjectRepository(repositoryState);
      case 'multiple':
      case 'none':
        return undefined;
      default:
        log.warn('Unknown repository state type:', repositoryState);
        return undefined;
    }
  }

  #translateProjectRepository(
    repositoryState: SingleProjectRepository | SelectedProjectRepository,
  ): ProjectInRepository | undefined {
    const { selectedProject, repository } = repositoryState;

    // Find the corresponding GitRepository from GitExtensionWrapper
    const gitRepository = this.#gitExtensionWrapper.gitRepositories.find(
      repo => repo.rootFsPath === repository.rootFsPath,
    );

    if (!gitRepository) {
      log.warn(
        `Could not find GitRepository for path: ${repository.rootFsPath} (folder: ${repository.folderName})`,
      );
      return undefined;
    }

    // The LSP now provides the pointer directly in selectedProject
    // Map the LSP pointer structure to the expected GitRemoteUrlPointer format
    const pointer: GitRemoteUrlPointer = {
      repository: gitRepository,
      remote: gitRepository.remotes.find(
        remote => remote.name === selectedProject.pointer.remote.name,
      ) || {
        name: selectedProject.pointer.remote.name,
        urlEntries: selectedProject.pointer.remote.urls.map(url => ({
          url: url.url,
          type: url.type,
        })),
      },
      urlEntry: {
        url: selectedProject.pointer.urlEntry.url,
        type: selectedProject.pointer.urlEntry.type,
      },
    };

    const fullAccount = this.#findFullAccount(selectedProject.account);
    if (!fullAccount) {
      log.warn(
        `Could not find full account for ${selectedProject.account.instanceUrl} (ID: ${selectedProject.account.restId}) in repository ${repository.folderName}`,
      );
      return undefined;
    }

    const project: GitLabProject = {
      ...selectedProject.project,
      // TODO: LS does not provide this information for now, need to add it, setting fallback values
      restId: -1,
      gqlId: '',
      description: '',
    };

    return {
      pointer,
      account: fullAccount,
      project,
      initializationType: 'selected',
    };
  }

  /**
   * Maps Language Server repository data to GitRepository object.
   * This is needed for commands that expect the full GitRepository interface.
   */
  mapToGitRepository(lsRepository: {
    rootFsPath: string;
    folderName: string;
  }): GitRepository | undefined {
    // Find the corresponding raw Repository from GitExtensionWrapper for the rawRepository property
    const gitRepository = this.#gitExtensionWrapper.gitRepositories.find(
      repo => repo.rootFsPath === lsRepository.rootFsPath,
    );

    if (!gitRepository) {
      log.warn(
        `Could not find GitRepository for path: ${lsRepository.rootFsPath} (folder: ${lsRepository.folderName})`,
      );
      return undefined;
    }

    return {
      rootFsPath: lsRepository.rootFsPath,
      remotes: gitRepository.remotes,
      hasSameRootAs: repository => lsRepository.rootFsPath === repository.rootUri.fsPath,
      rawRepository: gitRepository.rawRepository,
    };
  }

  #findFullAccount(lsAccount: { restId: number; instanceUrl: string }): Account | undefined {
    const normalizedInstanceUrl = removeTrailingSlash(lsAccount.instanceUrl);

    return this.#accountService.getAccount(makeAccountId(normalizedInstanceUrl, lsAccount.restId));
  }

  onRepositoriesChanged(callback: (projects: ProjectInRepository[]) => void): Disposable {
    return this.#repositoryClient.onRepositoriesChanged(repositoryStates => {
      const translatedProjects = repositoryStates
        .map(state => this.translateToProjectInRepository(state))
        .filter((project): project is ProjectInRepository => project !== undefined);
      callback(translatedProjects);
    });
  }
}
