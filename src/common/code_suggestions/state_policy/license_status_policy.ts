import vscode from 'vscode';
import { GitLabPlatformManagerForCodeSuggestions } from '../gitlab_platform_manager_for_code_suggestions';
import { diffEmitter } from '../../utils/diff_emitter';
import { GitLabPlatform } from '../../platform/gitlab_platform';
import { getSuggestionsAvailability } from '../api/get_code_suggestion_availability';
import { log } from '../../log';
import { CombinedPolicy } from './combined_policy';
import { StatePolicy, VisibleState } from './state_policy';

const isLicenseAvailable = async (platform: GitLabPlatform) => {
  try {
    const availabilityResponse = await platform.fetchFromApi(getSuggestionsAvailability());
    return availabilityResponse.currentUser.duoCodeSuggestionsAvailable;
  } catch (e) {
    log.error(
      `Failed to request information about Duo Pro license on ${platform.account.instanceUrl}`,
      e,
    );
    return false;
  }
};

export const NO_LICENSE: VisibleState = 'code-suggestions-no-license';

export class LicenseStatusPolicy implements StatePolicy {
  #subscriptions: vscode.Disposable[] = [];

  #eventEmitter = diffEmitter(new vscode.EventEmitter<boolean>());

  #manager: GitLabPlatformManagerForCodeSuggestions;

  #isLicenseAvailable = false;

  #dependency: StatePolicy;

  constructor(manager: GitLabPlatformManagerForCodeSuggestions, dependencies: StatePolicy[]) {
    this.#manager = manager;
    this.#dependency = new CombinedPolicy(...dependencies);
    this.#manager.onAccountChange(this.#updateEngaged);
    this.#subscriptions.push(
      this.#dependency.onEngagedChange(async () => {
        const platform = await this.#manager.getGitLabPlatform();
        await this.#updateEngaged(platform);
      }),
    );
  }

  async init() {
    const platform = await this.#manager.getGitLabPlatform();
    await this.#updateEngaged(platform);
  }

  get engaged() {
    return !this.#isLicenseAvailable;
  }

  #updateEngaged = async (platform: GitLabPlatform | undefined) => {
    if (this.#dependency.engaged) {
      return;
    }
    if (!platform) {
      this.#isLicenseAvailable = false;
      this.#eventEmitter.fire(this.engaged);
      return;
    }
    this.#isLicenseAvailable = await isLicenseAvailable(platform);
    this.#eventEmitter.fire(this.engaged);
  };

  state = NO_LICENSE;

  onEngagedChange = this.#eventEmitter.event;

  dispose(): void {
    this.#subscriptions.forEach(s => s.dispose());
  }
}
