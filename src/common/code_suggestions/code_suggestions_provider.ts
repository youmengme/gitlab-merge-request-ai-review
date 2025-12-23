import * as vscode from 'vscode';
import { FixedTimeCircuitBreaker } from '@gitlab-org/gitlab-lsp';
import fetch from '../fetch_logged';
import { log } from '../log';
import { GITLAB_COM_URL, REQUEST_TIMEOUT_MILLISECONDS } from '../constants';
import { GitLabProject } from '../platform/gitlab_project';
import {
  FeatureFlag,
  getLocalFeatureFlagService,
} from '../feature_flags/local_feature_flag_service';
import { prettyJson } from '../utils/json';
import { PostRequest } from '../platform/web_ide';
import { GitLabPlatformBase } from '../platform/gitlab_platform';
import { getDuoCodeSuggestionsLanguages } from '../utils/extension_configuration';
import { isMissingDefaultDuoGroupError, TimeoutError } from '../errors/fetch_error';
import { CodeSuggestionsTokenManager, CompletionToken } from './code_suggestions_token_manager';
import {
  Experiment,
  Model,
  Telemetry,
  codeSuggestionsTelemetry,
} from './code_suggestions_telemetry';
import { CodeSuggestionsStateManager } from './code_suggestions_state_manager';
import {
  MODEL_GATEWAY_DUO_CODE_SUGGESTIONS_API_URL,
  GITLAB_DUO_CODE_SUGGESTIONS_API_PATH,
  CODE_SUGGESTIONS_MIN_LENGTH,
} from './constants';
import { COMMAND_CODE_SUGGESTION_ACCEPTED } from './commands/code_suggestion_accepted';
import { LegacyApiFallbackConfig } from './legacy_api_fallback_config';
import { GitLabPlatformManagerForCodeSuggestions } from './gitlab_platform_manager_for_code_suggestions';
import {
  CodeSuggestionTelemetryState,
  CodeSuggestionsTelemetryManager,
  RejectCodeSuggestionReason,
} from './code_suggestions_telemetry_manager';
import {
  DefaultCodeSuggestionsChangeTracker,
  SuggestionChangeType,
} from './code_suggestions_changes_tracker';

export const CIRCUIT_BREAK_INTERVAL_MS = 10000;
export const MAX_ERRORS_BEFORE_CIRCUIT_BREAK = 4;

interface Choice {
  text: string;
  index: number;
  finish_reason: string;
}

interface CodeSuggestionsResponse {
  id: string;
  model: Model;
  experiments: Experiment[];
  object: string;
  created: number;
  choices: Choice[];
  usage: null;
}

interface CurrentFile {
  content_above_cursor: string;
  content_below_cursor: string;
  file_name: string;
  language_identifier: string; // https://code.visualstudio.com/docs/languages/identifiers
}

export interface CodeSuggestionPrompt {
  current_file: CurrentFile;
  prompt_version: number;
  project_id?: number;
  project_path?: string;
  telemetry: Telemetry[];
}

export class CodeSuggestionsProvider implements vscode.InlineCompletionItemProvider {
  #server: string;

  #debouncedCall?: NodeJS.Timeout;

  #debounceTimeMs = 500;

  #noDebounce: boolean;

  #tokenManager: CodeSuggestionsTokenManager;

  #manager: GitLabPlatformManagerForCodeSuggestions;

  #stateManager: CodeSuggestionsStateManager;

  #legacyApiFallbackConfig: LegacyApiFallbackConfig;

  #circuitBreaker = new FixedTimeCircuitBreaker(
    MAX_ERRORS_BEFORE_CIRCUIT_BREAK,
    CIRCUIT_BREAK_INTERVAL_MS,
  );

  #documentChangesTracker = new DefaultCodeSuggestionsChangeTracker();

  #subscriptions: vscode.Disposable[] = [];

  #languages = getDuoCodeSuggestionsLanguages();

  #isErrorMessageShown = false;

  constructor({
    manager,
    stateManager,
    legacyApiFallbackConfig,
    noDebounce = false,
  }: {
    manager: GitLabPlatformManagerForCodeSuggestions;
    stateManager: CodeSuggestionsStateManager;
    legacyApiFallbackConfig: LegacyApiFallbackConfig;
    noDebounce?: boolean;
  }) {
    this.#server = CodeSuggestionsProvider.#getServer();
    this.#debouncedCall = undefined;
    this.#noDebounce = noDebounce;
    this.#tokenManager = new CodeSuggestionsTokenManager(manager);
    this.#legacyApiFallbackConfig = legacyApiFallbackConfig;
    this.#manager = manager;
    this.#stateManager = stateManager;
    this.#subscribeToSettingsUpdate();
    this.#circuitBreaker.onOpen(() => log.warn('Code Suggestions API circuit breaker opened'));
    this.#circuitBreaker.onClose(() => log.info('Code Suggestions API circuit breaker closed'));
  }

  static #getServer(): string {
    const serverUrl = new URL(MODEL_GATEWAY_DUO_CODE_SUGGESTIONS_API_URL);
    log.debug(`AI Assist: Using server: ${serverUrl.href}`);
    return serverUrl.href;
  }

  // TODO: Sanitize prompt to prevent exposing sensitive information
  // Issue https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/692
  static #getPrompt(
    document: vscode.TextDocument,
    position: vscode.Position,
    project: GitLabProject | undefined,
  ): CodeSuggestionPrompt | undefined {
    const contentBeforeCursor = document.getText(
      new vscode.Range(0, 0, position.line, position.character),
    );

    const contentAfterCursor = document.getText(
      new vscode.Range(position.line, position.character, document.lineCount, 0),
    );

    const contentLength = contentBeforeCursor.length + contentAfterCursor.length;
    if (contentLength < CODE_SUGGESTIONS_MIN_LENGTH) {
      log.debug(
        `Code suggestion: Cancelling Prompt building as content length (${contentLength}) is less than ${CODE_SUGGESTIONS_MIN_LENGTH}`,
      );
      return undefined;
    }

    // Check if we are at the end of the line or only special characters after
    const currentLine = document.lineAt(position);
    const lineSuffix = currentLine.text.substring(position.character).trim();
    if (lineSuffix.length > 0) {
      const allowedCharactersPastCursorRegex = /^\s*[)}\]"'`]*\s*[:{;,]?\s*$/;
      if (!allowedCharactersPastCursorRegex.test(lineSuffix)) {
        log.debug(
          `Code suggestion: Cancelling Prompt building, as characters after the cursor in that line are not ignorable`,
        );

        return undefined;
      }
    }

    // We need only the relative file path for the prompt
    let docFileName = document.fileName;
    if (vscode.workspace.workspaceFolders !== undefined) {
      vscode.workspace.workspaceFolders.forEach(wsFolder => {
        const wsPath = wsFolder.uri.path;
        docFileName = docFileName.replace(wsPath, '');
      });
    }

    const payload = {
      prompt_version: 1,
      current_file: {
        file_name: docFileName,
        language_identifier: document.languageId,
        content_above_cursor: contentBeforeCursor,
        content_below_cursor: contentAfterCursor,
      },
      ...(project && {
        project_id: project.restId,
        project_path: project.namespaceWithPath,
      }),
      telemetry: codeSuggestionsTelemetry.toArray(),
    };

    return payload;
  }

  async getCompletions({
    document,
    position,
    cancellationToken,
  }: {
    document: vscode.TextDocument;
    position: vscode.Position;
    cancellationToken: vscode.CancellationToken;
  }): Promise<vscode.InlineCompletionItem[]> {
    if (!this.#stateManager.isActive()) {
      return [];
    }
    if (this.#circuitBreaker.isOpen()) {
      CodeSuggestionsTelemetryManager.rejectOpenedSuggestions();
      return [];
    }

    const platform = await this.#manager.getGitLabPlatform();
    if (!platform) {
      log.warn(
        'AI Assist: could not obtain suggestions, there is no active project or GitLab account registered. Open GitLab project or authorise to GitLab account with code suggestions enabled to continue.',
      );
      this.#stateManager.setError(true);
      return [];
    }

    const { instanceUrl } = platform.account;

    const gitlabRealm = instanceUrl.startsWith(GITLAB_COM_URL) ? 'saas' : 'self-managed';

    const prompt = CodeSuggestionsProvider.#getPrompt(document, position, platform.project);

    if (!prompt) {
      return [];
    }

    log.debug(
      `AI Assist: fetching completions ... (telemetry: ${prettyJson(
        codeSuggestionsTelemetry.toArray(),
        0,
      )})`,
    );

    // if previous suggestion exists (user has not accepted it) it means it was rejected and user request new one
    const traceID = CodeSuggestionsTelemetryManager.createSuggestion(
      document.languageId,
      gitlabRealm,
    );

    let response: CodeSuggestionsResponse;
    let model: Model = { engine: '', name: '', lang: '' }; // Defaults for telemetry of failed requests
    let experiments: Experiment[] = [];

    const gitlabMonolithApiAvailable =
      !this.#legacyApiFallbackConfig.shouldUseModelGateway() ||
      getLocalFeatureFlagService().isEnabled(FeatureFlag.ForceCodeSuggestionsViaMonolith);

    try {
      this.#stateManager.setLoading(true);
      if (gitlabMonolithApiAvailable) {
        response = await CodeSuggestionsProvider.fetchCompletionsFromGitLab(platform, prompt);
      } else {
        // FIXME: when we start supporting SM, we need to get the token from the **platform**, now the project might not match the token
        // Also, passing the project to the API might get deprecated: https://gitlab.com/gitlab-org/modelops/applied-ml/code-suggestions/ai-assist/-/merge_requests/143#note_1419849871
        const token = await this.#tokenManager.getToken();
        if (!token) {
          log.error('AI Assist: Could not fetch token');
          return [];
        }

        response = await this.fetchCompletions(platform, token, prompt, traceID);
      }

      if (response.model !== undefined) model = response.model;
      if (response.experiments !== undefined) experiments = response.experiments;
      CodeSuggestionsTelemetryManager.setSuggestionModel(traceID, model.name, model.engine);

      // right after request with suggestion comes back emit: suggestion_loaded
      CodeSuggestionsTelemetryManager.updateSuggestionState(
        traceID,
        CodeSuggestionTelemetryState.LOADED,
      );

      this.#stateManager.setError(false);
      this.#circuitBreaker.success();

      // The previous counts were successfully sent...
      codeSuggestionsTelemetry.resetCounts();

      if (!cancellationToken.isCancellationRequested) {
        // Keep track of this request for next send..
        codeSuggestionsTelemetry.storeExperiments(model, experiments);
        codeSuggestionsTelemetry.incRequestCount(model);
      } else {
        //  emit: suggestion_cancelled
        CodeSuggestionsTelemetryManager.updateSuggestionState(
          traceID,
          CodeSuggestionTelemetryState.CANCELLED,
        );
        log.debug(
          'Code suggestions result is discarded because the completion request has been cancelled by the VS Code',
        );
        return [];
      }
    } catch (e) {
      log.error(`AI Assist: Error fetching completions: ${e.toString()}`);

      if (isMissingDefaultDuoGroupError(e)) {
        await this.#showMissingDefaultDuoNamespaceErrorMessage();
      }

      this.#stateManager.setError(true);
      this.#circuitBreaker.error();

      codeSuggestionsTelemetry.storeExperiments(model, experiments);
      codeSuggestionsTelemetry.incRequestCount(model);
      codeSuggestionsTelemetry.incErrorCount(model);
      // emit: suggestion_error
      CodeSuggestionsTelemetryManager.updateSuggestionState(
        traceID,
        CodeSuggestionTelemetryState.ERROR,
      );
      return [];
    } finally {
      this.#stateManager.setLoading(false);
    }
    const choices = response.choices || [];

    log.debug(`AI Assist: got ${choices.length} completions`);

    // This command will be called when a suggestion is accepted
    const acceptedCommand: vscode.Command = {
      title: 'Code Suggestion Accepted',
      command: COMMAND_CODE_SUGGESTION_ACCEPTED,
      arguments: [model, traceID],
    };

    if (choices.length > 0 && choices.some(choice => choice.text.length > 0)) {
      CodeSuggestionsTelemetryManager.updateSuggestionState(
        traceID,
        CodeSuggestionTelemetryState.SHOWN,
      );
    } else {
      CodeSuggestionsTelemetryManager.updateSuggestionState(
        traceID,
        CodeSuggestionTelemetryState.NOT_PROVIDED,
      );
    }

    return choices.map(
      choice =>
        new vscode.InlineCompletionItem(
          choice.text,
          new vscode.Range(position, position),
          acceptedCommand,
        ),
    );
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    cancellationToken: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[]> {
    if (!this.#languages.includes(document.languageId)) {
      return [];
    }

    CodeSuggestionsTelemetryManager.rejectOpenedSuggestions();

    this.#documentChangesTracker.trackCompletionRequest(document, position);

    if (this.#debouncedCall !== undefined) {
      clearTimeout(this.#debouncedCall);
    }

    if (
      this.#documentChangesTracker.getLastChangeType(document) === SuggestionChangeType.NoChange &&
      context.selectedCompletionInfo
    ) {
      CodeSuggestionsTelemetryManager.rejectSuggestionRequest(
        RejectCodeSuggestionReason.UnchangedDocument,
      ).catch(e => log.error(e));
      return [];
    }

    if (
      this.#documentChangesTracker.getLastChangeType(document) ===
      SuggestionChangeType.DeletedCharacter
    ) {
      CodeSuggestionsTelemetryManager.rejectSuggestionRequest(
        RejectCodeSuggestionReason.DeletingSingleCharacter,
      ).catch(e => log.error(e));
      return [];
    }

    if (
      this.#documentChangesTracker.getLastChangeType(document) ===
      SuggestionChangeType.RepeatedSpaces
    ) {
      CodeSuggestionsTelemetryManager.rejectSuggestionRequest(
        RejectCodeSuggestionReason.TypingRepeatedSpaces,
      ).catch(e => log.error(e));
      return [];
    }

    return new Promise(resolve => {
      //  In case of a hover, this will be triggered which is not desired as it calls for a new prediction
      if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
        if (this.#noDebounce) {
          resolve(this.getCompletions({ document, position, cancellationToken }));
        } else {
          this.#debouncedCall = setTimeout(() => {
            resolve(this.getCompletions({ document, position, cancellationToken }));
          }, this.#debounceTimeMs);
        }
      }
    });
  }

  async fetchCompletions(
    platform: GitLabPlatformBase,
    token: CompletionToken,
    prompt: CodeSuggestionPrompt,
    traceID: string,
  ): Promise<CodeSuggestionsResponse> {
    log.debug(`AI Assist: fetching completions...`);

    const requestOptions = {
      method: 'POST',
      headers: {
        ...platform.getUserAgentHeader(),
        'X-Gitlab-Authentication-Type': 'oidc',
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(prompt),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
    } satisfies RequestInit;

    try {
      const response = await fetch(this.#server, requestOptions);

      await this.#handleErrorResponse(response, traceID);

      return await response.json();
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new TimeoutError(this.#server);
      }
      throw e;
    }
  }

  static async fetchCompletionsFromGitLab(
    platform: GitLabPlatformBase,
    prompt: CodeSuggestionPrompt,
  ): Promise<CodeSuggestionsResponse> {
    log.debug(`AI Assist: fetching completions via monolith...`);
    const codeSuggestionRequest: PostRequest<CodeSuggestionsResponse> = {
      type: 'rest',
      method: 'POST',
      path: GITLAB_DUO_CODE_SUGGESTIONS_API_PATH,
      body: prompt,
    };

    const response = await platform.fetchFromApi(codeSuggestionRequest);

    return response;
  }

  async #handleErrorResponse(response: Response, traceID: string) {
    if (!response.ok) {
      const body = await response.text().catch(() => undefined);
      CodeSuggestionsTelemetryManager.setSuggestionStatusCode(traceID, response.status);
      throw new Error(
        `Fetching code suggestions from ${response.url} failed for server ${this.#server}. Body: ${body}`,
      );
    }
  }

  async #showMissingDefaultDuoNamespaceErrorMessage() {
    const message =
      'Multiple GitLab Duo namespaces detected. In your user preferences, select a default GitLab Duo namespace.';
    const cta = 'View documentation';
    const ctaUrl =
      'https://docs.gitlab.com/user/gitlab_duo/model_selection/#assign-a-default-gitlab-duo-namespace';

    log.error(`${message} You can find more information in ${ctaUrl}.`);

    // Return early to ensure only one error message is shown at a time.
    if (this.#isErrorMessageShown) return;

    this.#isErrorMessageShown = true;
    const action = await vscode.window.showErrorMessage(message, cta);

    if (action === cta) {
      const uri = vscode.Uri.parse(ctaUrl);
      await vscode.env.openExternal(uri);
    }
  }

  #subscribeToSettingsUpdate() {
    this.#subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(() => {
        this.#languages = getDuoCodeSuggestionsLanguages();
      }),
    );
  }

  dispose() {
    this.#subscriptions.forEach(subscription => subscription.dispose());
  }
}
