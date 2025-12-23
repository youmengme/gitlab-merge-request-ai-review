import * as vscode from 'vscode';
import { CS_DISABLED_PROJECT_CHECK_INTERVAL } from '../constants';
import { getProjectCodeSuggestionsEnabled } from '../api/get_project_code_suggestions_enabled';
import { GitLabPlatform, GitLabPlatformForProject } from '../../platform/gitlab_platform';
import { log } from '../../log';
import { GitLabPlatformManagerForCodeSuggestions } from '../gitlab_platform_manager_for_code_suggestions';
import { diffEmitter } from '../../utils/diff_emitter';
import { DUO_ENABLE_WITHOUT_GITLAB_PROJECT } from '../../utils/extension_configuration';
import { extensionConfigurationService } from '../../utils/extension_configuration_service';
import { PassiveCache } from './passive_cache';
import { StatePolicy } from './state_policy';

export const DISABLED_BY_PROJECT = 'duo-disabled-for-project';

/** can return undefined if the API call failed with something other than 403 error */
const isDisabledForProject = async (platform: GitLabPlatformForProject) => {
  const result = await platform.fetchFromApi(
    getProjectCodeSuggestionsEnabled(platform.project.namespaceWithPath),
  );
  return !result.project?.duoFeaturesEnabled;
};

const setChatAvailableForProject = async (isDisabled: boolean) => {
  await vscode.commands.executeCommand('setContext', 'gitlab:chatAvailableForProject', !isDisabled);
};

export class ProjectDisabledPolicy implements StatePolicy {
  #subscriptions: vscode.Disposable[] = [];

  #isProjectDisabledCache = new PassiveCache<boolean>(CS_DISABLED_PROJECT_CHECK_INTERVAL);

  #eventEmitter = diffEmitter(new vscode.EventEmitter<boolean>());

  onEngagedChange = this.#eventEmitter.event;

  #manager: GitLabPlatformManagerForCodeSuggestions;

  /** undefined signals that we don't have a successful api response */
  #apiDisabledResponse: boolean | undefined;

  constructor(manager: GitLabPlatformManagerForCodeSuggestions) {
    this.#manager = manager;
    this.#subscriptions.push(
      this.#manager.onAccountChange(async platform => {
        await this.#checkIfGitLabProjectDisabled(platform, vscode.window.activeTextEditor);
        await setChatAvailableForProject(this.#isDisabled);
      }),
      vscode.window.onDidChangeActiveTextEditor(async te => {
        await this.#checkIfGitLabProjectDisabled(await this.#manager.getGitLabPlatform(), te);
        await setChatAvailableForProject(this.#isDisabled);
      }),
      vscode.workspace.onDidChangeConfiguration(async event => {
        if (!event.affectsConfiguration(DUO_ENABLE_WITHOUT_GITLAB_PROJECT)) {
          return;
        }
        await this.#checkIfGitLabProjectDisabled(await this.#manager.getGitLabPlatform());
        await setChatAvailableForProject(this.#isDisabled);
      }),
    );
  }

  async init() {
    await this.#checkIfGitLabProjectDisabled(
      await this.#manager.getGitLabPlatform(),
      vscode.window.activeTextEditor,
    );
    await setChatAvailableForProject(this.#isDisabled);
  }

  get engaged() {
    return this.#isDisabled;
  }

  /** are duo features disabled for the current project? */
  get #isDisabled() {
    return this.#apiDisabledResponse ?? this.#isDisabledByDefault();
  }

  /** this value is used if we can't contact API (e.g. project is on self-manged.com but the account is for gitlab.com) */
  #isDisabledByDefault(): boolean {
    const config = extensionConfigurationService.getConfiguration();
    return !config.duo.enabledWithoutGitLabProject;
  }

  state = DISABLED_BY_PROJECT;

  async #checkIfGitLabProjectDisabled(
    platform: GitLabPlatform | undefined,
    te?: vscode.TextEditor,
  ) {
    // clear existing disabled response before performing a new check
    this.#apiDisabledResponse = undefined;

    // abort if we don't have all the info
    if (!te || !platform?.project?.namespaceWithPath) {
      this.#eventEmitter.fire(this.engaged);
      return;
    }

    // try cache
    const disabledCache = this.#isProjectDisabledCache.get(platform.project.namespaceWithPath);
    if (disabledCache !== undefined) {
      this.#apiDisabledResponse = disabledCache;
      this.#eventEmitter.fire(this.engaged);
      return;
    }

    try {
      const disabledInApi = await isDisabledForProject(platform);
      this.#isProjectDisabledCache.set(platform.project.namespaceWithPath, disabledInApi);
      this.#apiDisabledResponse = disabledInApi;
    } catch (e) {
      log.debug(
        `Checking if suggestions are disabled for the project ${platform?.project?.namespaceWithPath} failed with: `,
        e,
      );
    }

    this.#eventEmitter.fire(this.engaged);
  }

  dispose() {
    this.#subscriptions.forEach(s => s.dispose());
  }
}
