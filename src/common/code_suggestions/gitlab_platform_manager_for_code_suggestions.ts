import vscode from 'vscode';
import { createInterfaceId } from '@gitlab/needle';
import { GitLabPlatformManager, GitLabPlatform } from '../platform/gitlab_platform';
import { diffEmitter } from '../utils/diff_emitter';

const arePlatformsEqual = (p1: GitLabPlatform | undefined, p2: GitLabPlatform | undefined) => {
  if (p1?.account.id !== p2?.account.id) return false;
  if (p1?.project?.restId !== p2?.project?.restId) return false;
  return true;
};

export interface GitLabPlatformManagerForCodeSuggestions extends vscode.Disposable {
  getGitLabPlatform(): Promise<GitLabPlatform | undefined>;
  onAccountChange: vscode.Event<GitLabPlatform | undefined>;
}

export const GitLabPlatformManagerForCodeSuggestions =
  createInterfaceId<GitLabPlatformManagerForCodeSuggestions>(
    'GitLabPlatformManagerForCodeSuggestions',
  );

export class GitLabPlatformManagerForCodeSuggestionsImpl
  implements GitLabPlatformManagerForCodeSuggestions
{
  readonly #platformManager: GitLabPlatformManager;

  #subscriptions: vscode.Disposable[] = [];

  #onAccountChangeEmitter = diffEmitter(
    new vscode.EventEmitter<GitLabPlatform | undefined>(),
    arePlatformsEqual,
  );

  constructor(platformManager: GitLabPlatformManager) {
    this.#platformManager = platformManager;
    this.#subscriptions.push(
      this.#onAccountChangeEmitter,
      this.#platformManager.onAccountChange(async () => {
        this.#onAccountChangeEmitter.fire(await this.getGitLabPlatform());
      }),
    );
  }

  async getGitLabPlatform(): Promise<GitLabPlatform | undefined> {
    const projectPlatform = await this.#platformManager.getForActiveProject(false);
    if (projectPlatform) {
      return projectPlatform;
    }
    return this.#platformManager.getForActiveAccount(false);
  }

  onAccountChange = this.#onAccountChangeEmitter.event;

  dispose() {
    this.#subscriptions.forEach(s => s.dispose());
  }
}
