import * as vscode from 'vscode';
import { SUGGESTIONS_API_ERROR } from '@gitlab-org/gitlab-lsp';
import { GitLabPlatformManager } from '../platform/gitlab_platform';
import { log } from '../log';
import { LanguageServerFeatureStateProvider } from '../language_server/language_server_feature_state_provider';
import {
  FeatureFlag,
  getLocalFeatureFlagService,
} from '../feature_flags/local_feature_flag_service';
import { diffEmitter } from '../utils/diff_emitter';
import {
  GitLabPlatformManagerForCodeSuggestions,
  GitLabPlatformManagerForCodeSuggestionsImpl,
} from './gitlab_platform_manager_for_code_suggestions';
import { DISABLED_BY_PROJECT, ProjectDisabledPolicy } from './state_policy/project_disabled_policy';
import { StatePolicy } from './state_policy/state_policy';
import {
  DISABLED_VIA_SETTINGS,
  DisabledInSettingsPolicy,
} from './state_policy/disabled_in_settings_policy';
import {
  DISABLED_BY_USER,
  disabledForSessionPolicy,
} from './state_policy/disabled_for_session_policy';
import { MissingAccountPolicy, NO_ACCOUNT } from './state_policy/missing_account_policy';
import {
  MinimumGitLabVersionPolicy,
  UNSUPPORTED_GITLAB_VERSION,
} from './state_policy/minimal_gitlab_version_policy';
import { CombinedPolicy } from './state_policy/combined_policy';
import { LicenseStatusPolicy, NO_LICENSE } from './state_policy/license_status_policy';
import {
  LanguagePolicy,
  DISABLED_LANGUAGE_VIA_SETTINGS,
  UNSUPPORTED_LANGUAGE,
} from './state_policy/language_policy';
import { LanguageServerPolicy } from './state_policy/language_server_policy';

type ValueOf<T> = T[keyof T];

export type VisibleCodeSuggestionsState = ValueOf<typeof VisibleCodeSuggestionsState>;
export const VisibleCodeSuggestionsState = {
  DISABLED_VIA_SETTINGS,
  DISABLED_LANGUAGE_VIA_SETTINGS,
  DISABLED_BY_USER,
  NO_ACCOUNT,
  NO_LICENSE,
  READY: 'code-suggestions-global-ready',
  UNSUPPORTED_LANGUAGE,
  DISABLED_BY_PROJECT,
  ERROR: 'code-suggestions-error',
  LOADING: 'code-suggestions-loading',
  UNSUPPORTED_GITLAB_VERSION,
  SUGGESTIONS_API_ERROR,
  AUTHENTICATION_REQUIRED: 'authentication-required',
  SUGGESTIONS_FILE_EXCLUDED: 'code-suggestions-file-excluded',
} as const;

export class CodeSuggestionsStateManager {
  #policies: StatePolicy[] = [];

  // boolean flags and counters indicating temporary states
  #isInErrorState = false;

  // this can't be a boolean flag because it's possible that response from first
  // request comes after we send second request (which would incorrectly set loading to false)
  #loadingCounter = 0;
  // //////////

  #subscriptions: vscode.Disposable[] = [];

  #gitlabPlatformManager: GitLabPlatformManager;

  #changeVisibleStateEmitter = diffEmitter(new vscode.EventEmitter<VisibleCodeSuggestionsState>());

  onDidChangeVisibleState = this.#changeVisibleStateEmitter.event;

  onDidChangeDisabledByUserState: vscode.Event<boolean>;

  #manager: GitLabPlatformManagerForCodeSuggestions;

  #userDisabledPolicy: StatePolicy;

  #missingAccountPolicy: MissingAccountPolicy;

  #languageServerFeatureStateProvider?: LanguageServerFeatureStateProvider;

  #extensionContext: vscode.ExtensionContext;

  constructor(
    gitlabPlatformManager: GitLabPlatformManager,
    context: vscode.ExtensionContext,
    languageServerFeatureStateProvider?: LanguageServerFeatureStateProvider,
  ) {
    this.#gitlabPlatformManager = gitlabPlatformManager;
    this.#manager = new GitLabPlatformManagerForCodeSuggestionsImpl(this.#gitlabPlatformManager);
    this.#extensionContext = context;
    const disabledInSettingsPolicy = new DisabledInSettingsPolicy();
    this.#userDisabledPolicy = new CombinedPolicy(
      disabledForSessionPolicy,
      disabledInSettingsPolicy,
    );
    this.onDidChangeDisabledByUserState = this.#userDisabledPolicy.onEngagedChange;
    this.#missingAccountPolicy = new MissingAccountPolicy(this.#manager);

    this.#policies.push(
      disabledInSettingsPolicy,
      disabledForSessionPolicy,
      this.#missingAccountPolicy,
    );

    this.#subscriptions.push(this.#manager);
    this.#languageServerFeatureStateProvider = languageServerFeatureStateProvider;
  }

  async init() {
    try {
      if (
        getLocalFeatureFlagService().isEnabled(FeatureFlag.LanguageServer) &&
        this.#languageServerFeatureStateProvider
      ) {
        this.#policies.push(
          new LanguageServerPolicy(
            this.#languageServerFeatureStateProvider,
            this.#extensionContext,
          ),
        );
      } else {
        // There are still some users who don't have the language server enabled in legacy versions.
        // These policies are used to ensure that code suggestions works for those users.
        const minimumGitLabVersionPolicy = new MinimumGitLabVersionPolicy(
          this.#manager,
          this.#extensionContext,
          new CombinedPolicy(this.#userDisabledPolicy, this.#missingAccountPolicy),
        );
        this.#policies.push(
          minimumGitLabVersionPolicy,
          new LicenseStatusPolicy(this.#manager, [
            this.#userDisabledPolicy,
            minimumGitLabVersionPolicy,
          ]),
          new ProjectDisabledPolicy(this.#manager),
          new LanguagePolicy(),
        );
      }
      await Promise.all(this.#policies.filter(p => Boolean(p.init)).map(p => p.init?.()));
    } catch (e) {
      log.error('Code suggestions status bar item failed to initialize due to an error: ', e);
    }

    this.#subscriptions.push(
      ...this.#policies.map(p => p.onEngagedChange(() => this.#fireChange())),
    );

    this.#changeVisibleStateEmitter.fire(this.getVisibleState());
  }

  async getPlatform() {
    return this.#manager.getGitLabPlatform();
  }

  isDisabledByUser() {
    return this.#userDisabledPolicy.engaged;
  }

  isMissingAccount() {
    return this.#missingAccountPolicy.engaged;
  }

  /** isActive indicates whether the suggestions are on and suggestion requests are being sent to the API */
  isActive() {
    const noPoliciesEngaged = this.#policies.every(p => !p.engaged);
    return noPoliciesEngaged;
  }

  getVisibleState(): VisibleCodeSuggestionsState {
    const activePolicy = this.#policies.find(p => p.engaged);
    if (activePolicy) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return activePolicy.state!;
    }

    if (this.#isInErrorState) {
      return VisibleCodeSuggestionsState.ERROR;
    }

    if (this.#loadingCounter !== 0) {
      return VisibleCodeSuggestionsState.LOADING;
    }

    return VisibleCodeSuggestionsState.READY;
  }

  #fireChange = () => {
    this.#changeVisibleStateEmitter.fire(this.getVisibleState());
  };

  // FIXME: This is used by the legacy non-LS version of code suggestions (WebIDE)
  // we should consider moving the non-LS logic into a separate file, mixing the two makes the logic confusing
  setError = (isError: boolean) => {
    this.#isInErrorState = isError;
    this.#fireChange();
  };

  setLoading = (isLoading: boolean) => {
    if (isLoading) {
      this.#loadingCounter += 1;
    } else {
      this.#loadingCounter = Math.max(0, this.#loadingCounter - 1);
    }
    this.#fireChange();
  };

  dispose() {
    this.#subscriptions.forEach(s => s.dispose());
  }
}
