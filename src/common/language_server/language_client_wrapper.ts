import path from 'path';
import vscode from 'vscode';
import {
  CODE_SUGGESTIONS_CATEGORY,
  DidChangeDocumentInActiveEditor,
  QUICK_CHAT_CATEGORY,
  QUICK_CHAT_EVENT,
  QUICK_CHAT_OPEN_TRIGGER as LS_QUICK_CHAT_OPEN_TRIGGER,
  TelemetryNotificationType,
  TokenCheckNotificationParams,
  TokenCheckNotificationType,
  TRACKING_EVENTS,
  AiContextEditorRequests,
  GitDiffRequest,
  FeatureStateChangeNotificationType,
  ClientConfig,
  RepositoriesChangedNotificationType,
  GetRepositoriesResponse,
} from '@gitlab-org/gitlab-lsp';
import {
  BaseLanguageClient,
  DidChangeConfigurationNotification,
  DidOpenTextDocumentNotification,
} from 'vscode-languageclient';
import { createInterfaceId, Injectable } from '@gitlab/needle';
import { GitLabPlatformManagerForCodeSuggestions } from '../code_suggestions/gitlab_platform_manager_for_code_suggestions';
import {
  getDuoCodeSuggestionsConfiguration,
  getDuoChatConfiguration,
  getHttpAgentConfiguration,
  getSecurityScannerConfiguration,
  parseDisabledSupportedLanguages,
} from '../utils/extension_configuration';
import { log } from '../log';
import {
  GitLabTelemetryEnvironment,
  GitLabTelemetryEnvironmentId,
} from '../platform/gitlab_telemetry_environment';
import { QUICK_CHAT_OPEN_TRIGGER } from '../quick_chat/constants';
import { LSGitProvider, LSGitProviderId } from '../git/ls_git_provider';
import { FeatureFlag } from '../feature_flags/constants';
import { getLocalFeatureFlagService } from '../feature_flags/local_feature_flag_service';
import { serializeAccountSafe } from '../platform/gitlab_account';
import {
  DEFAULT_WEBVIEW_NOTIFICATION_METHOD,
  DEFAULT_WEBVIEW_REQUEST_METHOD,
  handleWebviewNotification,
  handleWebviewRequest,
} from '../webview';
import { WebviewMessageRegistry } from '../webview/message_handlers/webview_message_registry';
import { extensionConfigurationService } from '../utils/extension_configuration_service';
import { TerminalManager } from '../duo_workflow/terminal_manager';
import { getActiveFileContext } from '../chat/gitlab_chat_file_context';
import { LanguageServerFeatureStateProvider } from './language_server_feature_state_provider';
import { ApplyEditClientWrapper } from './apply_edit_client_wrapper';
import { DocumentQualityHandler, GET_DIAGNOSTICS_REQUEST_METHOD } from './document_quality_handler';
import { DiagnosticsDelayMiddleware } from './diagnostics_delay_middleware';
import { SaveFileMiddleware } from './save_file_middleware';
import { DiffMiddleware } from './diff_middleware';
import { FileSnapshotProvider } from './file_snapshot_provider';
import { FormatEditsMiddleware } from './format_edits_middleware';
import { RepositoryClient, RepositoryRequestFunction } from './repository_client';

// Interface IDs for dependency injection
export const BaseLanguageClientId = createInterfaceId<BaseLanguageClient>('BaseLanguageClient');

const createNotifyFn =
  <T>(client: BaseLanguageClient, method: string) =>
  (param: T) =>
    client.sendNotification(method, param);

const createRequestFn =
  <T>(client: BaseLanguageClient, method: string) =>
  (param: T) =>
    client.sendRequest(method, param);

export interface LanguageClientWrapper {
  setCustomPlatformConfig(clientConfig: Partial<ClientConfig>): void;
  initAndStart(): Promise<void>;
  syncConfig(): Promise<void>;
  pingWithCredentials(): Promise<void>;
  sendSuggestionAcceptedEvent(trackingId: string, optionId?: number): Promise<void>;
  sendQuickChatOpenEvent(params: { trigger: QUICK_CHAT_OPEN_TRIGGER }): Promise<void>;
  sendQuickChatMessageEvent(params: { message: string }): Promise<void>;
  dispose(): void;
}

export const LanguageClientWrapper =
  createInterfaceId<LanguageClientWrapper>('LanguageClientWrapper');

@Injectable(LanguageClientWrapper, [
  BaseLanguageClientId,
  GitLabPlatformManagerForCodeSuggestions,
  GitLabTelemetryEnvironmentId,
  LSGitProviderId,
  WebviewMessageRegistry,
  LanguageServerFeatureStateProvider,
  TerminalManager,
  FileSnapshotProvider,
  RepositoryClient,
])
export class LanguageClientWrapperImpl implements LanguageClientWrapper {
  #client: BaseLanguageClient;

  #suggestionsManager: GitLabPlatformManagerForCodeSuggestions;

  #telemetryEnvironment: GitLabTelemetryEnvironment;

  #lsGitProvider: LSGitProvider;

  #subscriptions: vscode.Disposable[] = [];

  #webviewMessageRegistry: WebviewMessageRegistry;

  #languageServerFeatureStateProvider: LanguageServerFeatureStateProvider;

  #fileSnapshotProvider: FileSnapshotProvider;

  #applyEditClientWrapper = new ApplyEditClientWrapper();

  #documentQualityHandler: DocumentQualityHandler;

  #terminalManager: TerminalManager;

  #repositoryClient: RepositoryClient;

  #platformClientConfig?: Partial<ClientConfig>;

  constructor(
    client: BaseLanguageClient,
    suggestionsManager: GitLabPlatformManagerForCodeSuggestions,
    telemetryEnvironment: GitLabTelemetryEnvironment,
    lsGitProvider: LSGitProvider,
    webviewMessageRegistry: WebviewMessageRegistry,
    languageServerFeatureStateProvider: LanguageServerFeatureStateProvider,
    terminalManager: TerminalManager,
    fileSnapshotProvider: FileSnapshotProvider,
    repositoryClient: RepositoryClient,
  ) {
    this.#client = client;
    this.#suggestionsManager = suggestionsManager;
    this.#telemetryEnvironment = telemetryEnvironment;
    this.#lsGitProvider = lsGitProvider;
    this.#webviewMessageRegistry = webviewMessageRegistry;
    this.#languageServerFeatureStateProvider = languageServerFeatureStateProvider;
    this.#terminalManager = terminalManager;
    this.#fileSnapshotProvider = fileSnapshotProvider;
    this.#documentQualityHandler = new DocumentQualityHandler();
    this.#repositoryClient = repositoryClient;
    this.#subscriptions.push(this.#documentQualityHandler);
  }

  setCustomPlatformConfig(clientConfig: Partial<ClientConfig>): void {
    this.#platformClientConfig = clientConfig;
  }

  async initAndStart() {
    this.#client.registerProposedFeatures();
    this.#subscriptions.push();

    this.#client.onNotification(
      TokenCheckNotificationType,
      (response: TokenCheckNotificationParams) => {
        log.warn(
          `[auth] Token validation failed in Language Server: (${response.message}). This can happen during OAuth token refresh.`,
        );
      },
    );

    this.#client.onNotification('$/gitlab/openUrl', ({ url }) =>
      vscode.env.openExternal(url).then(result => {
        if (!result) {
          log.warn(`Unable to open URL: ${url}`);
        }

        return result;
      }),
    );

    const repositoryRequestFunction: RepositoryRequestFunction = (method, params) =>
      this.#client.sendRequest(method, params);

    this.#repositoryClient.setRequestFunction(repositoryRequestFunction);

    this.#client.onNotification(
      RepositoriesChangedNotificationType,
      (change: GetRepositoriesResponse) => {
        this.#repositoryClient.handleRepositoriesChanged(change);
      },
    );

    this.#terminalManager.setupRequests(this.#client);

    this.#subscriptions.push(this.#terminalManager);

    this.#client.onNotification('$/gitlab/openFile', ({ filePath }) => {
      const joinedPath = path.join(vscode.workspace.rootPath || '', filePath);

      return vscode.commands.executeCommand('vscode.open', vscode.Uri.file(joinedPath));
    });

    this.#client.onNotification('$/gitlab/copyText', async ({ text }) => {
      await vscode.env.clipboard.writeText(text);
      await vscode.window.showInformationMessage('Copied to clipboard');
    });

    this.#client.onRequest(AiContextEditorRequests.GIT_DIFF, (params: GitDiffRequest) => {
      log.debug(`Received git diff request: ${JSON.stringify(params)}`);
      return this.#handleGitDiffRequest(params);
    });
    this.#client.onRequest(AiContextEditorRequests.EDITOR_SELECTION, getActiveFileContext);

    this.#client.onRequest(
      DEFAULT_WEBVIEW_REQUEST_METHOD,
      handleWebviewRequest(this.#webviewMessageRegistry),
    );
    this.#client.onNotification(
      DEFAULT_WEBVIEW_NOTIFICATION_METHOD,
      handleWebviewNotification(this.#webviewMessageRegistry),
    );

    this.#client.onNotification(FeatureStateChangeNotificationType, async params => {
      this.#languageServerFeatureStateProvider.setStates(params);
    });

    this.#webviewMessageRegistry.initNotifier(
      createNotifyFn(this.#client, DEFAULT_WEBVIEW_NOTIFICATION_METHOD),
    );

    this.#webviewMessageRegistry.initRequester(
      createRequestFn(this.#client, DEFAULT_WEBVIEW_REQUEST_METHOD),
    );

    this.#client.onRequest(
      'workspace/applyEdit',
      this.#applyEditClientWrapper.handleApplyWorkspaceEdit,
    );
    this.#applyEditClientWrapper.addApplyEditMiddleware(new DiagnosticsDelayMiddleware());
    this.#applyEditClientWrapper.addApplyEditMiddleware(new SaveFileMiddleware());
    this.#applyEditClientWrapper.addApplyEditMiddleware(
      new DiffMiddleware(this.#fileSnapshotProvider),
    );
    this.#applyEditClientWrapper.addApplyEditMiddleware(new FormatEditsMiddleware());

    this.#client.onRequest(
      GET_DIAGNOSTICS_REQUEST_METHOD,
      this.#documentQualityHandler.getDiagnostics,
    );

    const timeoutError = new Error(
      'The GitLab Language Server failed to start in 10 seconds. Try to restart the GitLab extension.',
    );
    await Promise.race([
      this.#client.start(),
      new Promise((_, reject) => {
        setTimeout(() => reject(timeoutError), 10000);
      }),
    ]);
    this.#subscriptions.push({ dispose: () => this.#client.stop() });
    await this.syncConfig();
    await this.#sendOpenTabs();
    await this.#sendActiveDocument();

    const interval = setInterval(this.pingWithCredentials, 10 * 1000);
    this.#subscriptions.push(new vscode.Disposable(() => clearInterval(interval)));
  }

  // syncing credentials every 10s is a hotfix for https://gitlab.com/gitlab-org/gitlab/-/issues/504999#note_2405943396
  // the idea is that we ask people to disable the lsCredentialsSync FF to help us reproduce the issue again
  pingWithCredentials = async () => {
    if (!getLocalFeatureFlagService().isEnabled(FeatureFlag.LsCredentialsSync)) return;

    const platform = await this.#suggestionsManager.getGitLabPlatform();
    const account = platform?.account;

    if (account) {
      log.debug(
        `[auth] Syncing account credentials to language server ${serializeAccountSafe(account)}`,
      );
    } else {
      log.debug(`[auth] Sending empty credentials to language server (no account available)`);
    }
    await this.#client.sendNotification(DidChangeConfigurationNotification.type, {
      settings: { baseUrl: account?.instanceUrl, token: account?.token },
    });
  };

  syncConfig = async () => {
    const platform = await this.#suggestionsManager.getGitLabPlatform();
    if (!platform) {
      log.warn(
        'There is no GitLab account available. Sending empty credentials to GitLab Language Server',
      );
      // we let the LS know not to use the previous account
      await this.#client.sendNotification(DidChangeConfigurationNotification.type, {
        settings: { token: '' },
      });
      return;
    }
    const extensionConfiguration = extensionConfigurationService.getConfiguration();
    const httpAgentConfiguration = getHttpAgentConfiguration();
    const codeSuggestionsConfiguration = getDuoCodeSuggestionsConfiguration();
    const duoChatConfiguration = getDuoChatConfiguration();
    const securityScannerConfiguration = getSecurityScannerConfiguration();
    const isEnabled = (flag: FeatureFlag) => getLocalFeatureFlagService().isEnabled(flag);
    const settings: ClientConfig = {
      baseUrl: platform.account.instanceUrl,
      token: platform.account.token,
      telemetry: {
        trackingUrl: extensionConfiguration.trackingUrl,
        enabled: this.#telemetryEnvironment.isTelemetryEnabled(),
        actions: [{ action: TRACKING_EVENTS.SHOWN }, { action: TRACKING_EVENTS.ACCEPTED }],
      },
      featureFlags: {
        [FeatureFlag.CodeSuggestionsClientDirectToGateway]: isEnabled(
          FeatureFlag.CodeSuggestionsClientDirectToGateway,
        ),
        [FeatureFlag.StreamCodeGenerations]: isEnabled(FeatureFlag.StreamCodeGenerations),
        [FeatureFlag.RemoteSecurityScans]: isEnabled(FeatureFlag.RemoteSecurityScans),
        [FeatureFlag.EditFileDiagnosticsResponse]: isEnabled(
          FeatureFlag.EditFileDiagnosticsResponse,
        ),
        [FeatureFlag.DuoWorkflowBinary]: isEnabled(FeatureFlag.DuoWorkflowBinary),
        [FeatureFlag.UseDuoChatUiForFlow]: isEnabled(FeatureFlag.UseDuoChatUiForFlow),
      },
      openTabsContext: codeSuggestionsConfiguration.openTabsContext,
      suggestionsCache: codeSuggestionsConfiguration.suggestionsCache,
      codeCompletion: {
        enabled: codeSuggestionsConfiguration.enabled,
        additionalLanguages: codeSuggestionsConfiguration.additionalLanguages,
        disabledSupportedLanguages: parseDisabledSupportedLanguages(
          codeSuggestionsConfiguration.enabledSupportedLanguages,
        ),
      },
      logLevel: extensionConfiguration.debug ? 'debug' : 'info',
      projectPath: platform.project?.namespaceWithPath ?? '',
      ignoreCertificateErrors: extensionConfiguration.ignoreCertificateErrors,
      httpAgentOptions: {
        ...httpAgentConfiguration,
      },
      securityScannerOptions: {
        enabled: securityScannerConfiguration.enabled,
      },
      duo: {
        enabledWithoutGitlabProject: extensionConfiguration.duo.enabledWithoutGitLabProject,
        workflow: {},
        agentPlatform: {
          enabled: extensionConfiguration.duo.agentPlatform.enabled,
          connectionType: extensionConfiguration.duo.agentPlatform.connectionType,
          defaultNamespace: extensionConfiguration.duo.agentPlatform.defaultNamespace,
        },
      },
      duoChat: {
        enabled: duoChatConfiguration.enabled,
      },
      ...(this.#platformClientConfig ?? {}),
    };

    log.info(`Configuring Language Server - baseUrl: ${platform.account.instanceUrl}`);
    await this.#client.sendNotification(DidChangeConfigurationNotification.type, {
      settings,
    });
  };

  sendSuggestionAcceptedEvent = async (trackingId: string, optionId?: number) =>
    this.#client.sendNotification(TelemetryNotificationType.method, {
      category: CODE_SUGGESTIONS_CATEGORY,
      action: TRACKING_EVENTS.ACCEPTED,
      context: { trackingId, optionId },
    });

  sendQuickChatOpenEvent = async ({ trigger }: { trigger: QUICK_CHAT_OPEN_TRIGGER }) => {
    let openTrigger;

    if (trigger === QUICK_CHAT_OPEN_TRIGGER.SHORTCUT) {
      openTrigger = LS_QUICK_CHAT_OPEN_TRIGGER.SHORTCUT;
    } else if (trigger === QUICK_CHAT_OPEN_TRIGGER.CODE_ACTION_FIX_WITH_DUO) {
      openTrigger = LS_QUICK_CHAT_OPEN_TRIGGER.CODE_ACTION_FIX_WITH_DUO;
    } else {
      openTrigger = LS_QUICK_CHAT_OPEN_TRIGGER.BTN_CLICK;
    }

    await this.#client.sendNotification(TelemetryNotificationType.method, {
      category: QUICK_CHAT_CATEGORY,
      action: QUICK_CHAT_EVENT.CHAT_OPEN,
      context: { trigger: openTrigger },
    });
  };

  sendQuickChatMessageEvent = async ({ message }: { message: string }) =>
    this.#client.sendNotification(TelemetryNotificationType.method, {
      category: QUICK_CHAT_CATEGORY,
      action: QUICK_CHAT_EVENT.MESSAGE_SENT,
      context: { message },
    });

  async #sendOpenTabs() {
    try {
      const didOpenEvents = vscode.window.tabGroups.all.flatMap(tabGroup =>
        tabGroup.tabs
          .filter(tab => tab.input instanceof vscode.TabInputText)
          .map(tab => {
            const input = tab.input as vscode.TabInputText;

            return this.#sendDidOpenTextDocumentEvent(input.uri).catch(error => {
              log.warn(
                `Failed to send "textDocument.didOpen" event for "${input.uri.toString()}"`,
                error,
              );
              return null;
            });
          }),
      );

      log.debug(
        `Sending ${didOpenEvents.filter(Boolean).length} existing open text documents to language server`,
      );
      await Promise.all(didOpenEvents);
    } catch (error) {
      log.error('Failed to send existing open tabs to language server: ', error);
    }
  }

  async #sendActiveDocument() {
    if (vscode.window.activeTextEditor) {
      await this.#client.sendNotification(
        DidChangeDocumentInActiveEditor,
        vscode.window.activeTextEditor.document.uri.toString(),
      );
    }
  }

  async #sendDidOpenTextDocumentEvent(uri: vscode.Uri) {
    const textDocument = await vscode.workspace.openTextDocument(uri);

    return this.#client.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri: textDocument.uri.toString(),
        languageId: textDocument.languageId,
        version: textDocument.version,
        text: textDocument.getText(),
      },
    });
  }

  async #handleGitDiffRequest({
    repositoryUri,
    branch,
  }: {
    repositoryUri: string;
    branch?: string;
  }) {
    const uri = vscode.Uri.parse(repositoryUri);
    log.debug(`Getting git diff for ${repositoryUri} with branch ${branch}`);
    const diff = branch
      ? await this.#lsGitProvider.getDiffWithBranch(uri, branch)
      : await this.#lsGitProvider.getDiffWithHead(uri);
    return diff;
  }

  dispose = () => {
    this.#subscriptions.forEach(s => s.dispose());
  };
}
