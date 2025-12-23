import vscode from 'vscode';
import {
  CODE_SUGGESTIONS,
  StateCheckId,
  UNSUPPORTED_GITLAB_VERSION,
  FeatureStateCheck,
  MINIMUM_CODE_SUGGESTIONS_VERSION,
} from '@gitlab-org/gitlab-lsp';
import { log } from '../../log';
import { DO_NOT_SHOW_CODE_SUGGESTIONS_VERSION_WARNING } from '../../constants';
import { LanguageServerFeatureStateProvider } from '../../language_server/language_server_feature_state_provider';
import { StatePolicy } from './state_policy';

export const UNSUPPORTED_LANGUAGE = 'code-suggestions-document-unsupported-language';

export class LanguageServerPolicy implements StatePolicy {
  #subscriptions: vscode.Disposable[] = [];

  #eventEmitter = new vscode.EventEmitter<boolean>();

  #languageServerFeatureStateProvider: LanguageServerFeatureStateProvider;

  state?: StateCheckId;

  engaged = false;

  #context: vscode.ExtensionContext;

  #instanceUrlsWithShownDeprecatedVersionWarning: Record<string, boolean> = {};

  constructor(
    languageServerFeatureStateProvider: LanguageServerFeatureStateProvider,
    context: vscode.ExtensionContext,
  ) {
    this.#languageServerFeatureStateProvider = languageServerFeatureStateProvider;
    this.#context = context;
  }

  async init() {
    this.#subscriptions.push(
      this.#languageServerFeatureStateProvider.onChange(async checkResults => {
        if (!checkResults) {
          return;
        }

        const checks = checkResults[CODE_SUGGESTIONS];

        if (!checks || !checks.allChecks) {
          return;
        }

        const engagedCheck = checks.allChecks.find(ch => ch.engaged);
        const newState = engagedCheck?.checkId;
        const changed = newState !== this.state;
        this.state = newState;
        this.engaged = Boolean(newState);

        if (changed) {
          this.#eventEmitter.fire(this.engaged);
        }
        await this.#handleState(engagedCheck);
      }),
    );
  }

  onEngagedChange = this.#eventEmitter.event;

  dispose(): void {
    this.#subscriptions.forEach(s => s.dispose());
  }

  async #handleState(stateCheck?: FeatureStateCheck<StateCheckId>) {
    if (!stateCheck) return;

    if (stateCheck.checkId === UNSUPPORTED_GITLAB_VERSION && stateCheck.context) {
      await this.#deprecatedVersionHandler(stateCheck.context.baseUrl, stateCheck.context.version);
    }
  }

  // FIXME: Custom messages like these are deprecated in favour of the
  // src/common/user_message.ts component
  async #deprecatedVersionHandler(instanceUrl: string, version: string) {
    const DO_NOT_SHOW_AGAIN_TEXT = 'Do not show again';
    const warningMessage = new vscode.MarkdownString(`
        GitLab Duo Code Suggestions requires GitLab version ${MINIMUM_CODE_SUGGESTIONS_VERSION} or later.
        GitLab instance located at: [${instanceUrl}](${instanceUrl}) is currently using ${version}.
        [Click here](https://docs.gitlab.com/update/) to learn about upgrading.
      `);

    log.warn(warningMessage.value);

    if (instanceUrl in this.#instanceUrlsWithShownDeprecatedVersionWarning) return;

    const versionWarningRecords = this.#context.globalState.get<Record<string, boolean>>(
      DO_NOT_SHOW_CODE_SUGGESTIONS_VERSION_WARNING,
    );

    if (versionWarningRecords?.[instanceUrl]) return;

    this.#instanceUrlsWithShownDeprecatedVersionWarning[instanceUrl] = true;

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
