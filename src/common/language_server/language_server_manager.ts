import {
  DidChangeDocumentInActiveEditor,
  IClientContext,
  SUGGESTION_ACCEPTED_COMMAND,
} from '@gitlab-org/gitlab-lsp';
import vscode from 'vscode';
import { BaseLanguageClient, CancellationToken } from 'vscode-languageclient';
import { CodeSuggestionsGutterIcon } from '../code_suggestions/code_suggestions_gutter_icon';
import { CodeSuggestionsStateManager } from '../code_suggestions/code_suggestions_state_manager';
import { CodeSuggestionsStatusBarItem } from '../code_suggestions/code_suggestions_status_bar_item';
import {
  CODE_SUGGESTION_STREAM_ACCEPTED_COMMAND,
  codeSuggestionStreamAccepted,
} from '../code_suggestions/commands/code_suggestion_stream_accepted';
import {
  COMMAND_TOGGLE_CODE_SUGGESTIONS,
  toggleCodeSuggestions,
} from '../code_suggestions/commands/toggle';
import {
  COMMAND_RUN_SECURITY_SCAN,
  COMMAND_RUN_SECURITY_SCAN_VIEW_TITLE,
  runSecurityScan,
} from '../security_scans/run_security_scan';
import { DUO_WORKFLOW_PANEL_WEBVIEW_ID } from '../constants';
import { DependencyContainer } from '../dependency_container';
import { log } from '../log';
import {
  SHOW_QUICK_PICK_MENU,
  showDuoQuickPickMenu,
} from '../duo_quick_pick/commands/show_quick_pick_menu';
import { WebviewInfo } from '../webview/webview_info_provider';
import { Theme } from '../webview/theme/types';
import {
  COMMAND_QUICK_CHAT_MESSAGE_TELEMETRY,
  COMMAND_QUICK_CHAT_OPEN_TELEMETRY,
} from '../quick_chat/constants';
import {
  COMMAND_SHOW_VULNS_DETAILS,
  openRemoteSecurityVulnsDetails,
} from '../security_scans/open_vulns_details';
import { WebviewMessageRegistry } from '../webview/message_handlers/webview_message_registry';
import { WebviewManager } from '../webview/webview_manager';
import { getSecurityScannerConfiguration } from '../utils/extension_configuration';
import { onDidSaveActiveTextDocument } from '../utils/vscode_event';
import { VersionProvider } from '../state/version_state_provider';
import { extensionConfigurationService } from '../utils/extension_configuration_service';
import { LanguageClientFactory } from './client_factory';
import { LanguageClientMiddleware } from './language_client_middleware';
import { LanguageClientWrapper } from './language_client_wrapper';
import { LanguageServerFeatureStateProvider } from './language_server_feature_state_provider';

export class LanguageServerManager implements WebviewManager, VersionProvider {
  #client: BaseLanguageClient | undefined;

  #wrapper: LanguageClientWrapper | undefined;

  #context: vscode.ExtensionContext;

  #dependencyContainer: DependencyContainer;

  #clientFactory: LanguageClientFactory;

  #webviewMessageRegistry: WebviewMessageRegistry;

  #languageServerFeatureStateProvider: LanguageServerFeatureStateProvider;

  #subscriptions: vscode.Disposable[] = [];

  #versionChangeEmitter = new vscode.EventEmitter<{ version: string | undefined }>();

  #clientContext: IClientContext;

  createLanguageClientWrapper: ((client: BaseLanguageClient) => LanguageClientWrapper) | undefined;

  constructor(
    context: vscode.ExtensionContext,
    clientFactory: LanguageClientFactory,
    dependencyContainer: DependencyContainer,
    webviewMessageRegistry: WebviewMessageRegistry,
    languageServerFeatureStateProvider: LanguageServerFeatureStateProvider,
    clientContext: IClientContext,
  ) {
    this.#context = context;
    this.#clientFactory = clientFactory;
    this.#dependencyContainer = dependencyContainer;
    this.#webviewMessageRegistry = webviewMessageRegistry;
    this.#languageServerFeatureStateProvider = languageServerFeatureStateProvider;
    this.#clientContext = clientContext;
  }

  onChange = this.#versionChangeEmitter.event;

  setLanguageClientWrapper(wrapper: LanguageClientWrapper) {
    this.#wrapper = wrapper;
  }

  async startLanguageServer() {
    if (this.#client) {
      log.warn('Language server already started');
      return;
    }

    const { gitLabPlatformManager, gitLabTelemetryEnvironment } = this.#dependencyContainer;
    const stateManager = new CodeSuggestionsStateManager(
      gitLabPlatformManager,
      this.#context,
      this.#languageServerFeatureStateProvider,
    );
    const statusBarItem = new CodeSuggestionsStatusBarItem(stateManager);
    const gutterIcon = new CodeSuggestionsGutterIcon(this.#context, stateManager);
    const middleware = new LanguageClientMiddleware(stateManager);
    const baseAssetsUrl = vscode.Uri.joinPath(
      this.#context.extensionUri,
      './assets/language-server/',
    ).toString();

    this.#client = this.#clientFactory.createLanguageClient(this.#context, {
      documentSelector: [
        { scheme: 'file' },
        { notebook: '*' },
        { scheme: 'gitlab-web-ide' },
        { scheme: 'untitled' },
      ],
      initializationOptions: {
        ...this.#clientContext,
        baseAssetsUrl,
      },
      middleware,
    });

    middleware.client = this.#client;
    await stateManager.init();

    // Create the wrapper using DI if factory is available, otherwise use setLanguageClientWrapper
    if (this.createLanguageClientWrapper) {
      this.#wrapper = this.createLanguageClientWrapper(this.#client);
    } else if (!this.#wrapper) {
      throw new Error(
        'Language client wrapper must be set before starting the language server. Call setLanguageClientWrapper() first or provide createLanguageClientWrapper.',
      );
    }

    await this.#wrapper.initAndStart();
    const subscriptions = [
      this.#wrapper,
      vscode.commands.registerCommand(
        SUGGESTION_ACCEPTED_COMMAND,
        this.#wrapper.sendSuggestionAcceptedEvent,
      ),
      vscode.commands.registerCommand(COMMAND_TOGGLE_CODE_SUGGESTIONS, () =>
        toggleCodeSuggestions({ stateManager }),
      ),
      vscode.commands.registerCommand(SHOW_QUICK_PICK_MENU, () =>
        showDuoQuickPickMenu({ stateManager }),
      ),
      vscode.commands.registerCommand(
        CODE_SUGGESTION_STREAM_ACCEPTED_COMMAND,
        codeSuggestionStreamAccepted(this.#client),
      ),
      vscode.commands.registerCommand(
        COMMAND_RUN_SECURITY_SCAN,
        runSecurityScan(this.#client, gitLabPlatformManager, 'command'),
      ),
      vscode.commands.registerCommand(
        COMMAND_RUN_SECURITY_SCAN_VIEW_TITLE,
        runSecurityScan(this.#client, gitLabPlatformManager, 'command'),
      ),
      vscode.commands.registerCommand(
        COMMAND_SHOW_VULNS_DETAILS,
        openRemoteSecurityVulnsDetails(this.#client),
      ),
      onDidSaveActiveTextDocument(async () => {
        if (this.#client && getSecurityScannerConfiguration().scanFileOnSave) {
          await runSecurityScan(this.#client, gitLabPlatformManager, 'save')();
        }
      }),
      vscode.commands.registerCommand(
        COMMAND_QUICK_CHAT_OPEN_TELEMETRY,
        this.#wrapper?.sendQuickChatOpenEvent,
      ),
      vscode.commands.registerCommand(
        COMMAND_QUICK_CHAT_MESSAGE_TELEMETRY,
        this.#wrapper?.sendQuickChatMessageEvent,
      ),
      extensionConfigurationService.onChange(async () => this.#wrapper?.syncConfig()),
      gitLabTelemetryEnvironment.onDidChangeTelemetryEnabled(this.#wrapper.syncConfig),
      gitLabPlatformManager.onAccountChange(this.#wrapper.syncConfig),

      statusBarItem,
      gutterIcon,
      vscode.window.onDidChangeActiveTextEditor(async te => {
        if (te) {
          await this.#client?.sendNotification(
            DidChangeDocumentInActiveEditor,
            te.document.uri.toString(),
          );
        }
      }),
    ];
    this.#context.subscriptions.push(...subscriptions);
    this.#subscriptions = subscriptions;
    this.#versionChangeEmitter.fire({
      version: this.version,
    });
  }

  stopLanguageServer() {
    this.#wrapper?.dispose();
    return this.#client?.stop(5000);
  }

  getWebviewInfos(): Promise<WebviewInfo[]> {
    if (!this.#client)
      throw new Error(
        'Language Server client is not initialized. The manager cannot provide webview info',
      );
    return this.#client.sendRequest<WebviewInfo[]>('$/gitlab/webview-metadata');
  }

  publishWebviewTheme(theme: Theme): Promise<void> {
    if (!this.#client) {
      throw new Error('Language Server client is not initialized. Cannot publish webview theme.');
    }

    return this.#client.sendNotification('$/gitlab/theme/didChangeTheme', theme);
  }

  async setDuoWorkflowInitialState(initialState: Record<string, unknown>): Promise<void> {
    log.info(`Sending initial state: ${JSON.stringify(initialState)}`);
    // TODO: integrate this into new JSON-RPC pattern https://gitlab.com/groups/gitlab-org/editor-extensions/-/epics/137
    await this.sendNotification('$/gitlab/plugin/notification', {
      pluginId: DUO_WORKFLOW_PANEL_WEBVIEW_ID,
      type: 'setInitialState',
      payload: initialState,
    });
  }

  async restartLanguageServer() {
    if (this.#client) {
      await this.#client.stop();
      this.#client = undefined;
      this.#wrapper?.dispose();
    }
    for (const subscription of this.#subscriptions) {
      subscription.dispose();
    }
    this.#subscriptions = [];
    await this.startLanguageServer();
  }

  /**
   * Sends a request to the language server.
   * Returns undefined if the client is not initialized.
   */
  async sendRequest<R>(
    method: string,
    param?: unknown,
    token?: CancellationToken,
  ): Promise<undefined | R> {
    if (!this.#client) {
      return undefined;
    }
    return this.#client.sendRequest<R>(method, param, token);
  }

  /**
   * Sends a notification to the language server.
   * Returns undefined if the client is not initialized.
   */
  async sendNotification(method: string, param?: unknown): Promise<undefined | true> {
    if (!this.#client) {
      return undefined;
    }
    await this.#client.sendNotification(method, param);
    return true;
  }

  get version(): string | undefined {
    return this.#client?.initializeResult?.serverInfo?.version;
  }
}
