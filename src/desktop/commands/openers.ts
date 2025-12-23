import * as path from 'path';
import * as vscode from 'vscode';
import { VS_COMMANDS } from '../../common/command_names';
import { ifVersionGte } from '../../common/utils/if_version_gte';
import { GitLabProject } from '../../common/platform/gitlab_project';
import { ProjectInRepository } from '../gitlab/new_project';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { getTrackingBranchName } from '../git/get_tracking_branch_name';
import { getLastCommitSha } from '../git/get_last_commit_sha';
import { DetachedHeadError } from '../errors/detached_head_error';
import { Repository } from '../api/git';
import { WarningError } from '../errors/warning_error';
import { getProjectWithRepositoryInfo } from '../gitlab/api/get_projects_with_repository_info';
import { getPipelineAndMrForBranch } from '../gitlab/get_pipeline_and_mr_for_branch';
import { getOpenMergeRequestsForBranch } from '../gitlab/api/get_open_merge_requests_for_branch';
import { currentUserRequest } from '../../common/gitlab/api/get_current_user';
import {
  ProjectCommand,
  ProjectFileCommand,
  ProjectInRepositoryAndFile,
} from './run_with_valid_project';

export const openUrl = async (url: string): Promise<void> => {
  // workaround for a VS Code open command bug: https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/44
  const urlArgument = ifVersionGte<string | vscode.Uri>(
    vscode.version,
    '1.65.0',
    () => url,
    () => vscode.Uri.parse(url),
  );
  await vscode.commands.executeCommand(VS_COMMANDS.OPEN, urlArgument);
};

/**
 * Fetches user and project before opening a link.
 * Link can contain some placeholders which will be replaced by this method
 * with relevant information. Implemented placeholders below.
 *
 * $projectUrl
 * $userId
 *
 * An example link is `$projectUrl/-/issues?assignee_id=$userId` which will be
 * `gitlab.com/gitlab-org/gitlab-ce/-/issues?assignee_id=502136`.
 *
 * @param {string} linkTemplate
 * @param {RestUser} user current user
 * @param {GitLabProject} project
 */
async function getLink(linkTemplate: string, user: RestUser, project: GitLabProject) {
  return linkTemplate.replace('$userId', user.id.toString()).replace('$projectUrl', project.webUrl);
}

async function openTemplatedLink(linkTemplate: string, projectInRepository: ProjectInRepository) {
  const user = await getGitLabService(projectInRepository).fetchFromApi(currentUserRequest);
  await openUrl(await getLink(linkTemplate, user, projectInRepository.project));
}

async function getTrackingBranchNameOrThrow(rawRepository: Repository): Promise<string> {
  const branchName = await getTrackingBranchName(rawRepository);
  if (!branchName) throw new DetachedHeadError();
  return branchName;
}

export const showIssues: ProjectCommand = async projectInRepository => {
  await openTemplatedLink('$projectUrl/-/issues?assignee_id=$userId', projectInRepository);
};

export const showMergeRequests: ProjectCommand = async projectInRepository => {
  await openTemplatedLink('$projectUrl/-/merge_requests?assignee_id=$userId', projectInRepository);
};

async function getActiveFile({
  projectInRepository,
  activeEditor,
}: ProjectInRepositoryAndFile): Promise<string> {
  const { repository } = projectInRepository.pointer;

  const repoPath = repository.rootFsPath;
  const editorPath = activeEditor.document.uri.fsPath;
  if (!editorPath.startsWith(repoPath)) {
    throw new WarningError('The current file is not in the project repository.');
  }
  const filePath = path.relative(repoPath, editorPath).replace(/\\/g, '/');

  const log = await repository.rawRepository.log({ maxEntries: 1, path: filePath });

  if (log.length === 0) {
    throw new WarningError(
      'No link exists for the current file. Commit the current file to the repository.',
    );
  }
  const { project } = projectInRepository;
  const fileUrl = `${project.webUrl}/-/blob/${encodeURIComponent(log[0].hash)}/${filePath}`;
  let anchor = '';

  if (activeEditor.selection) {
    const { start, end } = activeEditor.selection;
    anchor = `#L${start.line + 1}`;

    if (end.line > start.line) {
      anchor += `-${end.line + 1}`;
    }
  }

  return `${fileUrl}${anchor}`;
}

export const openActiveFile: ProjectFileCommand = async projectInRepositoryAndFile => {
  await openUrl(await getActiveFile(projectInRepositoryAndFile));
};

export const copyLinkToActiveFile: ProjectFileCommand = async projectInRepositoryAndFile => {
  const fileUrl = await getActiveFile(projectInRepositoryAndFile);
  await vscode.env.clipboard.writeText(fileUrl);
};

export const openCurrentMergeRequest: ProjectCommand = async projectInRepository => {
  const { repository } = projectInRepository.pointer;
  const mrs = await getGitLabService(projectInRepository).fetchFromApi(
    getOpenMergeRequestsForBranch(
      projectInRepository.project,
      await getTrackingBranchNameOrThrow(repository.rawRepository),
    ),
  );

  if (mrs[0]) {
    await openUrl(mrs[0].web_url);
  }
};

export const openCreateNewIssue: ProjectCommand = async projectInRepository => {
  await openTemplatedLink('$projectUrl/-/issues/new', projectInRepository);
};

export const openCreateNewMr: ProjectCommand = async projectInRepository => {
  const { project, pointer } = projectInRepository;
  const branchName = await getTrackingBranchNameOrThrow(pointer.repository.rawRepository);

  await openUrl(
    `${project.webUrl}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(
      branchName,
    )}`,
  );
};

export const openProjectPage: ProjectCommand = async projectInRepository => {
  await openTemplatedLink('$projectUrl', projectInRepository);
};

export async function openCurrentPipeline(projectInRepository: ProjectInRepository): Promise<void> {
  const { pipeline } = await getPipelineAndMrForBranch(
    getGitLabService(projectInRepository),
    projectInRepository.project,
    await getTrackingBranchNameOrThrow(projectInRepository.pointer.repository.rawRepository),
  );

  if (pipeline) {
    await openUrl(pipeline.web_url);
  }
}

export const compareCurrentBranch: ProjectCommand = async projectInRepository => {
  const { project } = projectInRepository;
  const { repository } = projectInRepository.pointer;

  const projectWithRepoInfoResult = await getGitLabService(projectInRepository).fetchFromApi(
    getProjectWithRepositoryInfo(project.namespaceWithPath),
  );
  const projectWithRepoInfo = projectWithRepoInfoResult.project;
  if (!projectWithRepoInfo) {
    throw new Error(
      `Could not load project ${project.namespaceWithPath} from API, please try again.`,
    );
  }

  if (getLastCommitSha(repository.rawRepository) && projectWithRepoInfo.repository?.rootRef) {
    await openUrl(
      `${project.webUrl}/-/compare/${projectWithRepoInfo.repository.rootRef}...${getLastCommitSha(
        repository.rawRepository,
      )}`,
    );
  }
};

export const showErrorMessage = async (message: string) => {
  await vscode.window.showErrorMessage(message);
};
