import * as vscode from 'vscode';
import { isEmpty } from 'lodash';
import {
  API as GitAPI,
  RefType,
  RemoteSource,
  RemoteSourceProvider,
  RemoteSourcePublisher,
  Repository,
} from '../../api/git';
import { GitLabService } from '../gitlab_service';
import { Account } from '../../../common/platform/gitlab_account';
import { getGitLabServiceForAccount } from '../get_gitlab_service';
import {
  GqlProjectWithRepoInfo,
  getProjectWithRepositoryInfo,
  getProjectsWithRepositoryInfo,
} from '../api/get_projects_with_repository_info';
import { createProject } from '../api/create_project';
import { getNamespaceIdByPath } from '../api/get_namespace_id_by_path';
import { VS_COMMANDS } from '../../../common/command_names';
import { FetchError } from '../../../common/errors/fetch_error';
import { ModalError } from '../../errors/modal_error';
import { handleError } from '../../../common/errors/handle_error';
import { UserFriendlyError } from '../../../common/errors/user_friendly_error';
import { newRemoteName } from '../../git/new_remote_name';
import { NamespacePickerItem, pickNamespace } from './pick_namespace';
import {
  pickProjectNameAndVisibility,
  NameAndVisibilityPickerItem,
} from './pick_project_name_and_visibility';

const DEFAULT_COMMIT_MESSAGE = 'Initial commit';

export function convertUrlToWikiUrl(url: string): string {
  return url.replace(/\.git$/, '.wiki.git');
}

export type GitLabRemote = RemoteSource & {
  project: GqlProjectWithRepoInfo;
  url: string[];
  wikiUrl: string[];
};

export function remoteForProject(project: GqlProjectWithRepoInfo): GitLabRemote {
  const url = [project.sshUrlToRepo, project.httpUrlToRepo];

  return {
    name: `$(repo) ${project.fullPath}`,
    description: project.description,
    url,
    wikiUrl: url.map(convertUrlToWikiUrl),
    project,
  };
}

function retrievePathErrors(e: Error): string[] {
  if (e instanceof FetchError && e.status === 400) {
    const txt = e.details.response.body;
    const json = txt ? JSON.parse(txt) : null;
    return json?.message?.path ?? [];
  }
  return [];
}

export class GitLabRemoteSource implements RemoteSourceProvider, RemoteSourcePublisher {
  name: string;

  readonly icon = 'gitlab-logo';

  readonly supportsQuery = true;

  #gitlabService: GitLabService;

  #gitAPI: GitAPI;

  constructor(account: Account, gitAPI: GitAPI) {
    this.name = `GitLab (${account.instanceUrl} - ${account.username})`;
    this.#gitlabService = getGitLabServiceForAccount(account);
    this.#gitAPI = gitAPI;
  }

  async #createNewProject(
    namespace: NamespacePickerItem,
    visibility: NameAndVisibilityPickerItem,
    repository: Repository,
    progress?: vscode.Progress<{ message?: string }>,
  ) {
    progress?.report({ message: 'Creating new project…' });

    const { id: namespaceId } = namespace.isGroup
      ? await this.#gitlabService.fetchFromApi(getNamespaceIdByPath(namespace.fullPath))
      : { id: undefined };

    let newProject: RestProject;
    try {
      newProject = await this.#gitlabService.fetchFromApi(
        createProject({
          path: visibility.projectName,
          namespace_id: namespaceId,
          visibility: visibility.projectVisibility,
        }),
      );
    } catch (e) {
      const [pathError] = retrievePathErrors(e);
      if (pathError) {
        throw new ModalError(`Could not create GitLab project`, `Path ${pathError}`, e);
      } else {
        throw e;
      }
    }

    const newUrl =
      visibility.projectConnection === 'SSH'
        ? newProject.ssh_url_to_repo
        : newProject.http_url_to_repo;

    progress?.report({ message: 'Pushing to GitLab…' });

    try {
      const remoteName = newRemoteName(repository);

      await repository.addRemote(remoteName, newUrl);
      const branchName = repository.state.HEAD?.name ?? 'main';
      await repository.push(remoteName, branchName, true);
      return newProject;
    } catch (e) {
      throw new UserFriendlyError(
        `The project was created, but the folder was not pushed successfully: ${e}`,
        e,
      );
    }
  }

  async #publishToNewProject(uri: vscode.Uri, prepare: () => Promise<Repository>): Promise<void> {
    const namespace = await pickNamespace(this.#gitlabService);
    if (!namespace?.fullPath) return;

    const visibility = await pickProjectNameAndVisibility(namespace, uri);
    if (!visibility) return;

    const newProject = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Publishing to GitLab',
      },
      async progress => {
        try {
          progress?.report({ message: 'Preparing…' });
          const repository = await prepare();
          return await this.#createNewProject(namespace, visibility, repository, progress);
        } catch (e) {
          handleError(e);
          return undefined;
        }
      },
    );

    if (!newProject) return;

    if (
      await vscode.window.showInformationMessage(
        'Your workspace has been published on GitLab.',
        'View on GitLab',
      )
    ) {
      await vscode.commands.executeCommand(VS_COMMANDS.OPEN, vscode.Uri.parse(newProject.web_url));
    }
  }

  async publishFolder(uri: vscode.Uri): Promise<void> {
    const existingRepository = this.#gitAPI.repositories.find(r => r.rootUri.fsPath === uri.fsPath);
    if (existingRepository) {
      await this.publishRepository(existingRepository);
      return;
    }

    const [anyFile] = await vscode.workspace.findFiles(
      new vscode.RelativePattern(uri, '*'),
      null,
      1,
    );
    if (!anyFile) {
      await vscode.window.showErrorMessage(
        'Workspace is empty. To push to GitLab, first add a file to the folder.',
      );
      return;
    }

    await this.#publishToNewProject(uri, async () => {
      const repository = await this.#gitAPI.init(uri);
      if (!repository) {
        throw new ModalError(
          'Could not create local Git repository. Check the logs for more information.',
        );
      }
      await repository.commit(DEFAULT_COMMIT_MESSAGE, { all: true });
      return repository;
    });
  }

  async publishRepository(repository: Repository): Promise<void> {
    if (repository.state.HEAD?.type !== RefType.Head || !isEmpty(repository.state.mergeChanges)) {
      await vscode.window.showErrorMessage(
        'The repository seems to be in a detached HEAD state. Please check out a branch.',
      );
      return;
    }

    if (
      !repository.state.HEAD?.commit &&
      isEmpty(repository.state.indexChanges) &&
      isEmpty(repository.state.workingTreeChanges)
    ) {
      await vscode.window.showErrorMessage(
        'Workspace is empty. To push to GitLab, first add a file to the folder.',
      );
      return;
    }

    await this.#publishToNewProject(repository.rootUri, async () => {
      if (!repository.state.HEAD?.commit) {
        if (isEmpty(repository.state.indexChanges)) {
          await repository.commit(DEFAULT_COMMIT_MESSAGE, { all: true });
        } else {
          await repository.commit(DEFAULT_COMMIT_MESSAGE);
        }
      }
      return repository;
    });
  }

  async lookupByPath(path: string): Promise<GitLabRemote | undefined> {
    const { project } = await this.#gitlabService.fetchFromApi(getProjectWithRepositoryInfo(path));
    if (!project) return undefined;

    return remoteForProject(project);
  }

  async getRemoteSources(query?: string): Promise<GitLabRemote[]> {
    const result = await this.#gitlabService.fetchFromApi(
      getProjectsWithRepositoryInfo({
        search: query,
      }),
    );

    return result.projects.nodes
      .filter(project => !project.repository?.empty)
      .map(project => remoteForProject(project));
  }
}
