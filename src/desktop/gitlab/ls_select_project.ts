import vscode from 'vscode';
import {
  MultipleProjectRepository,
  GitRemoteUrlPointer,
  ClearProjectParams,
} from '@gitlab-org/gitlab-lsp';
import { RepositoryClient } from '../../common/language_server/repository_client';
import { GitRepository } from '../git/new_git';
import { MultipleProjectsItem } from '../tree_view/items/multiple_projects_item';
import { ProjectItemModel } from '../tree_view/items/project_item_model';

type ProjectOption = {
  label: string;
  description?: string;
  detail?: string;
  isOther: boolean;
  projectData?: {
    project: { name: string; namespaceWithPath: string; webUrl: string };
    account: { id: string; username: string; restId: number; instanceUrl: string };
    pointer: GitRemoteUrlPointer;
    initializationType: 'detected' | 'selected';
  };
};

const selectProject = async (
  _: GitRepository,
  repositoryClient: RepositoryClient,
  repositoryState?: MultipleProjectRepository,
) => {
  let options: ProjectOption[] = [];

  if (repositoryState?.projects && repositoryState.projects.length > 0) {
    options = [
      ...repositoryState.projects.map(p => ({
        label: p.project.namespaceWithPath,
        description: 'detected',
        detail: `${p.account.instanceUrl} (${p.account.username})`,
        isOther: false as const,
        projectData: p,
      })),
    ];
  }

  options.push({
    label: 'Manually assign GitLab project to repository',
    detail: 'Select this option if your Git remote URL does not follow a standard format',
    isOther: true as const,
  });

  const selectedProject = await vscode.window.showQuickPick(options, {
    title: 'Select GitLab Project',
  });

  if (!selectedProject) return;

  if (selectedProject.isOther) {
    // TODO: implement manual assignment
    return;
  }

  if (selectedProject.projectData) {
    const selectProjectParams = repositoryState?.projects.find(
      p => p.project.namespaceWithPath === selectedProject.projectData?.project.namespaceWithPath,
    );

    if (selectProjectParams) {
      try {
        await repositoryClient.selectProject(selectProjectParams);
      } catch (error) {
        await vscode.window.showErrorMessage(
          `Failed to select project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }
};

export const lsSelectProjectCommand = async (
  item: MultipleProjectsItem,
  repositoryClient: RepositoryClient,
  repositoryState?: MultipleProjectRepository,
) => selectProject(item.repository, repositoryClient, repositoryState);

export const lsClearSelectedProjects = async (
  item: ProjectItemModel,
  repositoryClient: RepositoryClient,
) => {
  const params: ClearProjectParams = {
    rootFsPath: item.projectInRepository.pointer.repository.rootFsPath,
  };

  try {
    await repositoryClient.clearSelectedProjects(params);
    await vscode.window.showInformationMessage(
      `Cleared selected projects for repository ${params.rootFsPath}`,
    );
  } catch (error) {
    await vscode.window.showErrorMessage(
      `Failed to clear selected projects: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};
