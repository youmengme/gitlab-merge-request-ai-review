import vscode from 'vscode';
import { GitLabPlatformManagerForCodeSuggestions } from '../gitlab_platform_manager_for_code_suggestions';
import { diffEmitter } from '../../utils/diff_emitter';
import { StatePolicy, VisibleState } from './state_policy';

export const NO_ACCOUNT: VisibleState = 'code-suggestions-no-account';

export class MissingAccountPolicy implements StatePolicy {
  #subscriptions: vscode.Disposable[] = [];

  #eventEmitter = diffEmitter(new vscode.EventEmitter<boolean>());

  #manager: GitLabPlatformManagerForCodeSuggestions;

  #isMissingAccount = false;

  constructor(manager: GitLabPlatformManagerForCodeSuggestions) {
    this.#manager = manager;
    this.#manager.onAccountChange(platform => {
      this.#isMissingAccount = !platform;
      this.#eventEmitter.fire(this.engaged);
    });
  }

  async #checkIfAccountIsMissing() {
    const platform = await this.#manager.getGitLabPlatform();
    return !platform;
  }

  async init() {
    this.#isMissingAccount = await this.#checkIfAccountIsMissing();
  }

  get engaged() {
    return this.#isMissingAccount;
  }

  state = NO_ACCOUNT;

  onEngagedChange = this.#eventEmitter.event;

  dispose(): void {
    this.#subscriptions.forEach(s => s.dispose());
  }
}
