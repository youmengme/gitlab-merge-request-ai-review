import assert from 'assert';
import vscode from 'vscode';
import { groupBy } from 'lodash';
import { AccountService } from '../accounts/account_service';
import { hasPresentKey } from '../utils/has_present_key';
import { notNullOrUndefined } from '../../common/utils/not_null_or_undefined';
import { uniq } from '../utils/uniq';
import { GitExtensionWrapper } from '../git/git_extension_wrapper';
import { createRemoteUrlPointers, GitRemoteUrlPointer } from '../git/new_git';
import { log } from '../../common/log';
import { jsonStringifyWithSortedKeys } from '../utils/json_stringify_with_sorted_keys';
import { prettyJson } from '../../common/utils/json';
import { EnsureLatestPromise } from '../utils/ensure_latest_promise';
import { Account } from '../../common/platform/gitlab_account';
import { WorkspaceAccountManager } from '../accounts/workspace_account_manager';
import { parseProjects } from '../git/git_remote_parser';
import { ExistingProject, ProjectInRepository, SelectedProjectSetting } from './new_project';
import { convertProjectToSetting, SelectedProjectStore } from './selected_project_store';
import { tryToGetProjectFromInstance } from './try_to_get_project_from_instance';

export interface GitLabProjectRepository {
  getDefaultAndSelectedProjects(): ProjectInRepository[];
  getProjectsForRepository(rootFsPath: string): ProjectInRepository[];
  getSelectedOrDefaultForRepository(rootFsPath: string): ProjectInRepository | undefined;
  /** Returns selected or default project for repository root. If there's no initialized project it throws assertion error. */
  getProjectOrFail(rootFsPath: string): ProjectInRepository;
  repositoryHasAmbiguousProjects(rootFsPath: string): boolean;
  init(workspaceAccountManager: WorkspaceAccountManager): Promise<void>;
  reload(): Promise<void>;
  readonly onProjectChange: vscode.Event<readonly ProjectInRepository[]>;
}

const detectProjects = async (
  remoteUrls: string[],
  account: Account,
  getProject: typeof tryToGetProjectFromInstance,
): Promise<ExistingProject[]> => {
  const uniqRemoteUrls = uniq(remoteUrls);
  const parsedProjects = parseProjects(uniqRemoteUrls, account.instanceUrl);
  const projectsWithCredentials = parsedProjects.map(pp => ({ ...pp, account }));
  const loadedProjects = await Promise.all(
    projectsWithCredentials.map(async p => {
      const project = await getProject(p.account, p.namespaceWithPath);
      return { ...p, project };
    }),
  );
  return loadedProjects.filter(hasPresentKey('project'));
};

const assignProjectsToRepositories = async (
  pointers: GitRemoteUrlPointer[],
  existingProjects: ExistingProject[],
) => {
  const pointersByRemoteUrl = groupBy(pointers, p => p.urlEntry.url);
  return existingProjects.flatMap(ep =>
    pointersByRemoteUrl[ep.remoteUrl].map(pointer => ({
      ...ep,
      pointer,
    })),
  );
};

const loadProjectFromSettings = async (
  settings: SelectedProjectSetting,
  pointers: GitRemoteUrlPointer[],
  account: Account,
  getProject: typeof tryToGetProjectFromInstance,
): Promise<ProjectInRepository | undefined> => {
  const [pointer] = pointers.filter(
    p =>
      p.remote.name === settings.remoteName &&
      p.repository.rootFsPath === settings.repositoryRootPath &&
      p.urlEntry.url === settings.remoteUrl,
  );
  if (!pointer) {
    log.warn(
      `Unable to find remote ${settings.remoteName} (${settings.remoteUrl}) in repository ${settings.repositoryRootPath}. Ignoring selected project ${settings.namespaceWithPath}.`,
    );
    return undefined;
  }
  if (account.id !== settings.accountId) {
    log.warn(
      `Unable to find credentials for account ${settings.accountId}. Ignoring selected project ${settings.namespaceWithPath}.`,
    );
    return undefined;
  }
  const project = await getProject(account, settings.namespaceWithPath);
  if (!project) {
    log.warn(
      `Unable to fetch selected project ${settings.namespaceWithPath} from ${account.instanceUrl}. Ignoring this selected project`,
    );
    return undefined;
  }
  return { account, pointer, project, initializationType: 'selected' };
};

const mergeSelectedAndDetected = (
  selectedProjects: ProjectInRepository[],
  detectedProjects: ProjectInRepository[],
): ProjectInRepository[] => {
  const result = [...selectedProjects, ...detectedProjects].reduce<{
    addedProjectIds: string[];
    uniqueProjects: ProjectInRepository[];
  }>(
    (acc, project) => {
      const id = jsonStringifyWithSortedKeys({ ...convertProjectToSetting(project) });
      if (acc.addedProjectIds.includes(id)) return acc;
      return {
        addedProjectIds: [...acc.addedProjectIds, id],
        uniqueProjects: [...acc.uniqueProjects, project],
      };
    },
    { addedProjectIds: [], uniqueProjects: [] },
  );
  return result.uniqueProjects;
};

const loadSelectedProjects = async (
  selectedProjectSettings: SelectedProjectSetting[],
  account: Account,
  pointers: GitRemoteUrlPointer[],
  getProject: typeof tryToGetProjectFromInstance,
): Promise<ProjectInRepository[]> => {
  const allRepositoryPaths = uniq(pointers.map(p => p.repository.rootFsPath));
  const settingsByRepository = groupBy(selectedProjectSettings, pc => pc.repositoryRootPath);
  const relevantSettings = allRepositoryPaths.flatMap(path => settingsByRepository[path] ?? []);
  return (
    await Promise.all(
      relevantSettings.map(async s => loadProjectFromSettings(s, pointers, account, getProject)),
    )
  ).filter(notNullOrUndefined);
};

export const initializeAllProjects = async (
  account: Account,
  pointers: GitRemoteUrlPointer[],
  selectedProjectSettings: SelectedProjectSetting[],
  getProject = tryToGetProjectFromInstance,
): Promise<ProjectInRepository[]> => {
  const detectedProjects = await detectProjects(
    uniq(pointers.map(p => p.urlEntry.url)),
    account,
    getProject,
  );
  const detectedProjectsInRepositories = await assignProjectsToRepositories(
    pointers,
    detectedProjects,
  );
  const selectedProjectsInRepositories = await loadSelectedProjects(
    selectedProjectSettings,
    account,
    pointers,
    getProject,
  );
  return mergeSelectedAndDetected(selectedProjectsInRepositories, detectedProjectsInRepositories);
};

const getSelectedOrDefault = (projects: ProjectInRepository[]): ProjectInRepository | undefined => {
  if (projects.length === 1) return projects[0];
  const [selected] = projects.filter(p => p.initializationType === 'selected');
  return selected;
};

export class GitLabProjectRepositoryImpl implements GitLabProjectRepository {
  #emitter = new vscode.EventEmitter<ProjectInRepository[]>();

  #accountService: AccountService;

  #gitExtensionWrapper: GitExtensionWrapper;

  #selectedProjectsStore: SelectedProjectStore;

  #projects: ProjectInRepository[] = [];

  #ensureLatestPromise = new EnsureLatestPromise<ProjectInRepository[]>();

  #accountManager: WorkspaceAccountManager;

  constructor(
    accountService: AccountService,
    gitExtensionWrapper: GitExtensionWrapper,
    selectedProjectStore: SelectedProjectStore,
    workspaceAccountManager: WorkspaceAccountManager,
  ) {
    this.#accountService = accountService;
    this.#gitExtensionWrapper = gitExtensionWrapper;
    this.#selectedProjectsStore = selectedProjectStore;
    this.#accountManager = workspaceAccountManager;
  }

  async init(): Promise<void> {
    this.#accountService.onDidChange(this.#updateProjects, this);
    this.#gitExtensionWrapper.onRepositoryCountChanged(this.#updateProjects, this);
    this.#selectedProjectsStore.onSelectedProjectsChange(this.#updateProjects, this);
    this.#accountManager.onChange(async () => {
      await this.#updateProjects();
    });

    await this.#updateProjects();
  }

  onProjectChange = this.#emitter.event;

  getDefaultAndSelectedProjects(): ProjectInRepository[] {
    const repositoryPaths = uniq(this.#projects.map(p => p.pointer.repository.rootFsPath));

    return repositoryPaths
      .map(path => this.getSelectedOrDefaultForRepository(path))
      .filter(notNullOrUndefined);
  }

  getProjectsForRepository(rootFsPath: string): ProjectInRepository[] {
    return this.#projects.filter(p => p.pointer.repository.rootFsPath === rootFsPath);
  }

  getSelectedOrDefaultForRepository(rootFsPath: string): ProjectInRepository | undefined {
    const projects = this.getProjectsForRepository(rootFsPath);
    return getSelectedOrDefault(projects);
  }

  getProjectOrFail(rootFsPath: string): ProjectInRepository {
    const project = this.getSelectedOrDefaultForRepository(rootFsPath);
    assert(project, `There is no initialized GitLab project in ${rootFsPath} repository.`);
    return project;
  }

  repositoryHasAmbiguousProjects(rootFsPath: string): boolean {
    const projects = this.getProjectsForRepository(rootFsPath);
    return projects.length > 1 && getSelectedOrDefault(projects) === undefined;
  }

  async #updateProjects() {
    if (!this.#accountManager) {
      throw new Error(
        "The project repository has not been correctly initialized with init() function, this error is not recoverable. It's an application bug.",
      );
    }

    const pointers = this.#gitExtensionWrapper.gitRepositories.flatMap(createRemoteUrlPointers);
    log.info(`Extracted urls: ${prettyJson(pointers.map(p => p.urlEntry.url))}`);
    const projects = await this.#ensureLatestPromise.discardIfNotLatest(
      async () => {
        const account = this.#accountManager.activeAccount;
        if (!account) return [];
        return initializeAllProjects(
          account,
          pointers,
          this.#selectedProjectsStore.selectedProjectSettings,
        );
      },
      `More recent project update in progress, discarding findings for urls: ${prettyJson(
        pointers.map(p => p.urlEntry.url),
      )}`,
    );
    // the only way how projects can be undefined is if we discarded this update because of a more recent one
    if (!projects) {
      return;
    }
    this.#projects = projects;
    this.#emitter.fire(this.#projects);
    log.info(
      `Found ${this.#projects.length} projects for urls: ${prettyJson(
        pointers.map(p => p.urlEntry.url),
      )}`,
    );
  }

  reload() {
    return this.#updateProjects();
  }
}

let repository: GitLabProjectRepository;

export const setGlobalProjectRepository = (r: GitLabProjectRepository) => {
  repository = r;
};

export const getProjectRepository = () => {
  if (!repository)
    throw new Error('ProjectRepository has not been initialized. This is not recoverable error.');
  return repository;
};
