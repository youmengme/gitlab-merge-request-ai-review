/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as vscode from 'vscode';
import { API, BranchProtectionProvider, GitExtension, Repository } from '../api/git';
import { gitlabCredentialsProvider } from '../gitlab/clone/gitlab_credentials_provider';
import { GitLabRemoteSourceRepository } from '../gitlab/clone/gitlab_remote_source_repository';
import { log } from '../../common/log';
import { handleError } from '../../common/errors/handle_error';
import { GitRepository, GitRepositoryImpl } from './new_git';

export class GitExtensionWrapper implements vscode.Disposable {
  apiListeners: vscode.Disposable[] = [];

  #enablementListener?: vscode.Disposable;

  #gitRepositories: GitRepository[] = [];

  #repositoryCountChangedEmitter = new vscode.EventEmitter<void>();

  /** Gets triggered when user adds or removes repository or when user enables and disables the git extension */
  onRepositoryCountChanged = this.#repositoryCountChangedEmitter.event;

  #gitApi?: API;

  #gitExtension?: GitExtension;

  #remoteSourceRepository?: GitLabRemoteSourceRepository;

  get remoteSourceRepository() {
    return this.#remoteSourceRepository;
  }

  async onDidChangeGitExtensionEnablement(enabled: boolean) {
    if (enabled) {
      this.#register();
      await this.#addRepositories(this.#gitApi?.repositories ?? []);
    } else {
      this.#repositoryCountChangedEmitter.fire();
      this.disposeApiListeners();
    }
  }

  get gitBinaryPath(): string {
    const path = this.#gitApi?.git.path;
    assert(path, 'Could not get git binary path from the Git extension.');
    return path;
  }

  /**
   * returns list of our repository wrappers, these wrappers keep the reference to the original repository so when you access
   * remotes, you always get the latest version (depending on when the SCM VS Code panel got updated)
   */
  get gitRepositories(): GitRepository[] {
    return this.#gitRepositories;
  }

  getRepositoryForFile(fileUri: vscode.Uri): GitRepository | undefined {
    const rawRepository = this.#gitApi?.getRepository(fileUri);
    if (!rawRepository) return undefined;
    const result = this.gitRepositories.find(r => r.hasSameRootAs(rawRepository));
    if (!result) log.warn(`GitExtensionWrapper is missing repository for ${rawRepository.rootUri}`);
    return result;
  }

  #register() {
    assert(this.#gitExtension);
    try {
      this.#gitApi = this.#gitExtension.getAPI(1);
      this.#remoteSourceRepository = new GitLabRemoteSourceRepository(this.#gitApi);
      // TODO: We should improve the code below.
      // eslint-disable-next-line no-unused-expressions
      [
        this.#remoteSourceRepository,
        this.#gitApi.registerCredentialsProvider(gitlabCredentialsProvider),
        this.#gitApi.onDidOpenRepository(r => this.#addRepositories([r])),
        this.#gitApi.onDidCloseRepository(r => this.#removeRepository(r)),
      ];
    } catch (err) {
      handleError(err);
    }
  }

  registerBranchProtectionProvider(
    root: vscode.Uri,
    provider: BranchProtectionProvider,
  ): vscode.Disposable {
    assert(this.#gitApi);
    return this.#gitApi.registerBranchProtectionProvider(root, provider);
  }

  async #addRepositories(repositories: Repository[]) {
    await Promise.all(repositories.map(r => r.status())); // make sure the repositories are initialized
    this.#gitRepositories = [
      ...this.#gitRepositories,
      ...repositories.map(r => new GitRepositoryImpl(r)),
    ];
    this.#repositoryCountChangedEmitter.fire();
  }

  #removeRepository(repository: Repository) {
    this.#gitRepositories = this.#gitRepositories.filter(gr => !gr.hasSameRootAs(repository));
    this.#repositoryCountChangedEmitter.fire();
  }

  disposeApiListeners(): void {
    this.#gitApi = undefined;
    this.#remoteSourceRepository?.dispose();
    this.#remoteSourceRepository = undefined;
    this.apiListeners.forEach(d => d?.dispose());
    this.apiListeners = [];
  }

  dispose(): void {
    this.disposeApiListeners();
    this.#enablementListener?.dispose();
  }

  async init(): Promise<void> {
    try {
      this.#gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
      if (!this.#gitExtension) {
        log.error('Could not get Git Extension');
        return;
      }
      this.#enablementListener = this.#gitExtension.onDidChangeEnablement(
        this.onDidChangeGitExtensionEnablement,
        this,
      );
      await this.onDidChangeGitExtensionEnablement(this.#gitExtension.enabled);
    } catch (error) {
      handleError(error);
    }
  }
}

export const gitExtensionWrapper = new GitExtensionWrapper();
