import * as vscode from 'vscode';
import {
  DO_NOT_SHOW_CODE_SUGGESTIONS_VERSION_WARNING,
  MINIMUM_CODE_SUGGESTIONS_VERSION,
} from '../../constants';
import { log } from '../../log';
import { ifVersionGte } from '../../utils/if_version_gte';
import { GetRequest } from '../../platform/web_ide';
import { GitLabPlatformManagerForCodeSuggestions } from '../gitlab_platform_manager_for_code_suggestions';
import { diffEmitter } from '../../utils/diff_emitter';
import { doNotAwait } from '../../utils/do_not_await';
import { DUO_CODE_SUGGESTIONS_CONFIG_NAMESPACE } from '../constants';
import { StatePolicy, VisibleState } from './state_policy';

export const UNSUPPORTED_GITLAB_VERSION: VisibleState =
  'code-suggestions-unsupported-gitlab-version';

export const versionRequest: GetRequest<{ version: string }> = {
  type: 'rest',
  method: 'GET',
  path: '/version',
};
const DO_NOT_SHOW_AGAIN_TEXT = 'Do not show again';

export class MinimumGitLabVersionPolicy implements StatePolicy {
  #subscriptions: vscode.Disposable[] = [];

  #codeSuggestionsPlatformManager: GitLabPlatformManagerForCodeSuggestions;

  #context: vscode.ExtensionContext;

  #instanceUrlsWithShownWarnings: Record<string, boolean> = {};

  #eventEmitter = diffEmitter(new vscode.EventEmitter<boolean>());

  #isVersionDeprecated = false;

  #userDisabledPolicy: StatePolicy;

  constructor(
    codeSuggestionsPlatformManager: GitLabPlatformManagerForCodeSuggestions,
    context: vscode.ExtensionContext,
    userDisabledPolicy: StatePolicy,
  ) {
    this.#codeSuggestionsPlatformManager = codeSuggestionsPlatformManager;
    this.#context = context;
    this.#userDisabledPolicy = userDisabledPolicy;

    this.#subscriptions.push(
      this.#codeSuggestionsPlatformManager.onAccountChange(async () => {
        await this.#checkCodeSuggestionsVersion();
      }),
      vscode.workspace.onDidChangeConfiguration(async e => {
        if (e.affectsConfiguration(DUO_CODE_SUGGESTIONS_CONFIG_NAMESPACE)) {
          await this.#checkCodeSuggestionsVersion();
        }
      }),
    );
  }

  async init() {
    await this.#checkCodeSuggestionsVersion();
  }

  get engaged() {
    return this.#isVersionDeprecated;
  }

  state = UNSUPPORTED_GITLAB_VERSION;

  onEngagedChange = this.#eventEmitter.event;

  dispose() {
    this.#subscriptions.forEach(s => s.dispose());
  }

  async #checkCodeSuggestionsVersion(): Promise<void> {
    if (this.#userDisabledPolicy.engaged) {
      return;
    }

    const platform = await this.#codeSuggestionsPlatformManager.getGitLabPlatform();

    if (!platform) {
      return;
    }

    const resp = await platform.fetchFromApi(versionRequest);
    const version = resp?.version;

    if (!version) {
      return;
    }

    const { instanceUrl } = platform.account;

    await ifVersionGte(
      version,
      MINIMUM_CODE_SUGGESTIONS_VERSION,
      () => {
        this.#isVersionDeprecated = false;
        this.#eventEmitter.fire(this.engaged);
      },
      async () => {
        this.#isVersionDeprecated = true;
        this.#eventEmitter.fire(this.engaged);
        doNotAwait(this.#deprecatedVersionHandler(instanceUrl, version));
      },
    );
  }

  async #deprecatedVersionHandler(instanceUrl: string, version: string) {
    const warningMessage = new vscode.MarkdownString(`
        GitLab Duo Code Suggestions requires GitLab version 16.8 or later.
        GitLab instance located at: [${instanceUrl}](${instanceUrl}) is currently using ${version}.
        [Click here](https://docs.gitlab.com/update/) to learn about upgrading.
      `);

    log.warn(warningMessage.value);

    if (instanceUrl in this.#instanceUrlsWithShownWarnings) return;

    const versionWarningRecords = this.#context.globalState.get<Record<string, boolean>>(
      DO_NOT_SHOW_CODE_SUGGESTIONS_VERSION_WARNING,
    );

    if (versionWarningRecords?.[instanceUrl]) return;

    this.#instanceUrlsWithShownWarnings[instanceUrl] = true;

    const action = await vscode.window.showWarningMessage(
      warningMessage.value,
      DO_NOT_SHOW_AGAIN_TEXT,
    );

    if (action === DO_NOT_SHOW_AGAIN_TEXT) {
      await this.#context.globalState.update(DO_NOT_SHOW_CODE_SUGGESTIONS_VERSION_WARNING, {
        ...versionWarningRecords,
        [instanceUrl]: true,
      });
    }
  }
}
