import path from 'path';
import vscode from 'vscode';
import { GitRepository } from '../../git/new_git';
import { USER_COMMANDS } from '../../command_names';

export class NoProjectItem extends vscode.TreeItem {
  repository: GitRepository;

  constructor(repository: GitRepository) {
    const folderName = path.basename(repository.rootFsPath);
    super(`${folderName} (no GitLab project)`);
    this.repository = repository;
    this.iconPath = new vscode.ThemeIcon('error');
    this.contextValue = 'no-project-detected';
    this.command = {
      command: USER_COMMANDS.SELECT_PROJECT,
      title: 'Select GitLab Project',
      arguments: [this],
    };
  }
}
