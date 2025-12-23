import path from 'path';
import vscode from 'vscode';
import { MultipleProjectRepository } from '@gitlab-org/gitlab-lsp';
import { GitRepository } from '../../git/new_git';
import { USER_COMMANDS } from '../../command_names';

export class MultipleProjectsItem extends vscode.TreeItem {
  repository: GitRepository;

  repositoryState?: MultipleProjectRepository;

  constructor(repository: GitRepository, repositoryState?: MultipleProjectRepository) {
    const folderName = path.basename(repository.rootFsPath);
    super(`${folderName} (multiple projects, click to select)`);
    this.repository = repository;
    this.repositoryState = repositoryState;
    this.iconPath = new vscode.ThemeIcon('warning');
    this.contextValue = 'multiple-projects-detected';
    this.command = {
      command: USER_COMMANDS.SELECT_PROJECT,
      title: 'Select GitLab Project',
      arguments: [this],
    };
  }
}
