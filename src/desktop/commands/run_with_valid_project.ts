import * as vscode from 'vscode';
import { fromJobLogUri } from '../ci/job_log_uri';
import { fromMergedYamlUri } from '../ci/merged_yaml_uri';
import { JOB_LOG_URI_SCHEME, MERGED_YAML_URI_SCHEME, REVIEW_URI_SCHEME } from '../constants';
import { gitExtensionWrapper } from '../git/git_extension_wrapper';
import { getProjectRepository } from '../gitlab/gitlab_project_repository';
import { ProjectInRepository } from '../gitlab/new_project';
import { fromReviewUri } from '../review/review_uri';

export interface ProjectInRepositoryAndFile {
  projectInRepository: ProjectInRepository;
  activeEditor: vscode.TextEditor;
}

export interface RepositoryRootWebviewProvider {
  matchesViewType(viewType: string): boolean;
  get repositoryRootForActiveTab(): string | undefined;
}

export function getRepositoryRootForUri(uri: vscode.Uri): string | undefined {
  switch (uri.scheme) {
    case JOB_LOG_URI_SCHEME:
      return fromJobLogUri(uri).repositoryRoot;
    case MERGED_YAML_URI_SCHEME:
      return fromMergedYamlUri(uri).repositoryRoot;
    case REVIEW_URI_SCHEME:
      return fromReviewUri(uri).repositoryRoot;
    default:
      return gitExtensionWrapper.getRepositoryForFile(uri)?.rootFsPath;
  }
}

const webviewControllers: Array<RepositoryRootWebviewProvider> = [];

export function registerRepositoryRootProvider(...providers: Array<RepositoryRootWebviewProvider>) {
  webviewControllers.push(...providers);
}

function getRepositoryRootForActiveEditor(): string | undefined {
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab?.input;

  if (!tab) return undefined;

  if (
    tab instanceof vscode.TabInputText ||
    tab instanceof vscode.TabInputCustom ||
    tab instanceof vscode.TabInputNotebook
  ) {
    return getRepositoryRootForUri(tab.uri);
  }
  if (tab instanceof vscode.TabInputTextDiff || tab instanceof vscode.TabInputNotebookDiff) {
    return getRepositoryRootForUri(tab.original);
  }
  if (tab instanceof vscode.TabInputWebview) {
    return webviewControllers.find(w => w.matchesViewType(tab.viewType))
      ?.repositoryRootForActiveTab;
  }

  return undefined;
}

/**
 * This method doesn't require any user input and should be used only for automated functionality.
 * (e.g. periodical status bar refresh). If there is any uncertainty about which repository to choose,
 * (i.e. there's multiple repositories and no open editor) we return undefined.
 */
export const getActiveProject: () => ProjectInRepository | undefined = () => {
  const activeEditorRootFsPath = getRepositoryRootForActiveEditor();

  if (activeEditorRootFsPath) {
    return getProjectRepository().getSelectedOrDefaultForRepository(activeEditorRootFsPath);
  }

  const projects = getProjectRepository().getDefaultAndSelectedProjects();
  if (projects.length === 1) return projects[0];

  // set workspace folder as active project if it's single-folder workspace
  const { workspaceFolders } = vscode.workspace;
  if (workspaceFolders && workspaceFolders.length === 1) {
    const singleWorkspaceFolder = workspaceFolders[0];
    const repositoryRoot = getRepositoryRootForUri(singleWorkspaceFolder.uri);
    if (repositoryRoot)
      return getProjectRepository().getSelectedOrDefaultForRepository(repositoryRoot);
  }

  return undefined;
};

/**
 * Returns active repository, user-selected repository or undefined if there
 * are no repositories or user didn't select one.
 */
export const getActiveProjectOrSelectOne: () => Promise<
  ProjectInRepository | undefined
> = async () => {
  const activeProject = getActiveProject();

  if (activeProject) {
    return activeProject;
  }

  if (getProjectRepository().getDefaultAndSelectedProjects().length === 0) {
    return undefined;
  }

  const projectOptions = getProjectRepository()
    .getDefaultAndSelectedProjects()
    .map(p => ({
      label: p.project.name,
      project: p,
    }));
  const selection = await vscode.window.showQuickPick(projectOptions, {
    placeHolder: 'Select a project',
  });
  return selection?.project;
};

/** Command that needs a valid GitLab project to run */
export type ProjectCommand = (projectInRepository: ProjectInRepository) => Promise<void>;

/** Command that needs to be executed on an open file from a valid GitLab project */
export type ProjectFileCommand = (
  projectInRepositoryAndFile: ProjectInRepositoryAndFile,
) => Promise<void>;

export const runWithValidProject =
  (command: ProjectCommand): (() => Promise<void>) =>
  async () => {
    const projectInRepository = await getActiveProjectOrSelectOne();
    if (!projectInRepository) {
      return undefined;
    }
    return command(projectInRepository);
  };

export const runWithValidProjectFile =
  (command: ProjectFileCommand): (() => Promise<void>) =>
  async () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      await vscode.window.showInformationMessage('GitLab Workflow: No open file.');
      return undefined;
    }

    const projectInRepository = getActiveProject();

    if (!projectInRepository) {
      await vscode.window.showInformationMessage(
        'GitLab Workflow: Open file isn’t part of a repository with a GitLab project.',
      );
      return undefined;
    }
    return command({ activeEditor, projectInRepository });
  };
