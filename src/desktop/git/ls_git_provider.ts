import * as vscode from 'vscode';
import { LSGitProvider } from '../../common/git/ls_git_provider';
import { gitExtensionWrapper } from './git_extension_wrapper';

export class LSGitProviderDesktop implements LSGitProvider {
  #gitExtensionWrapper = gitExtensionWrapper;

  async #findRepository(uri: vscode.Uri) {
    return this.#gitExtensionWrapper.gitRepositories.find(
      repo => repo.rawRepository.rootUri.fsPath === uri.fsPath,
    );
  }

  async getDiffWithHead(repositoryUri: vscode.Uri): Promise<string | undefined> {
    const repository = await this.#findRepository(repositoryUri);
    if (!repository) {
      return undefined;
    }
    return repository.rawRepository.diffWithHEAD(repositoryUri.fsPath);
  }

  async getDiffWithBranch(repositoryUri: vscode.Uri, branch: string): Promise<string | undefined> {
    const repository = await this.#findRepository(repositoryUri);
    if (!repository) {
      return undefined;
    }
    return repository.rawRepository.diffWith(branch, repositoryUri.fsPath);
  }
}
