import * as vscode from 'vscode';
import { GitExtensionWrapper } from '../git/git_extension_wrapper';
import { GitLabProjectRepository } from './gitlab_project_repository';
import { ProjectInRepository } from './new_project';
import { ProtectedBranchProvider } from './protected_branch_provider';

export class ProtectedBranchManager implements vscode.Disposable {
  #projectSubscription: vscode.Disposable;

  #gitExtensionWrapper: GitExtensionWrapper;

  #providerSubscriptions: vscode.Disposable[] = [];

  constructor(gew: GitExtensionWrapper, gpr: GitLabProjectRepository) {
    this.#gitExtensionWrapper = gew;
    this.#projectSubscription = gpr.onProjectChange(this.#onProjectChange, this);
  }

  #onProjectChange(projects: readonly ProjectInRepository[]) {
    vscode.Disposable.from(...this.#providerSubscriptions).dispose();

    this.#providerSubscriptions = projects.map(p => this.#registerBranchProtectionProvider(p));
  }

  #registerBranchProtectionProvider(project: ProjectInRepository): vscode.Disposable {
    const uri = vscode.Uri.file(project.pointer.repository.rootFsPath);
    const provider = new ProtectedBranchProvider(uri, project);

    return vscode.Disposable.from(
      this.#gitExtensionWrapper.registerBranchProtectionProvider(uri, provider),
      provider,
    );
  }

  dispose() {
    this.#projectSubscription.dispose();
    vscode.Disposable.from(...this.#providerSubscriptions).dispose();
  }
}
