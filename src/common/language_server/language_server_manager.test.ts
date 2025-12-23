import vscode from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import {
  DidChangeDocumentInActiveEditor,
  IClientContext,
  SUGGESTION_ACCEPTED_COMMAND,
} from '@gitlab-org/gitlab-lsp';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { createExtensionContext } from '../test_utils/entities';
import { createActiveTextEditorChangeTrigger } from '../test_utils/vscode_fakes';
import { COMMAND_TOGGLE_CODE_SUGGESTIONS } from '../code_suggestions/commands/toggle';
import { SHOW_QUICK_PICK_MENU } from '../duo_quick_pick/commands/show_quick_pick_menu';
import { CodeSuggestionsStateManager } from '../code_suggestions/code_suggestions_state_manager';
import { CodeSuggestionsGutterIcon } from '../code_suggestions/code_suggestions_gutter_icon';
import { CODE_SUGGESTION_STREAM_ACCEPTED_COMMAND } from '../code_suggestions/commands/code_suggestion_stream_accepted';
import { GitLabPlatformManagerForCodeSuggestionsImpl } from '../code_suggestions/gitlab_platform_manager_for_code_suggestions';
import { DependencyContainer } from '../dependency_container';
import { Theme } from '../webview/theme/types';
import { DUO_WORKFLOW_PANEL_WEBVIEW_ID } from '../constants';
import {
  COMMAND_QUICK_CHAT_MESSAGE_TELEMETRY,
  COMMAND_QUICK_CHAT_OPEN_TELEMETRY,
} from '../quick_chat/constants';
import { WebviewMessageRegistry } from '../webview';
import {
  ExtensionConfiguration,
  ExtensionConfigurationService,
} from '../utils/extension_configuration_service';
import { LanguageClientWrapperImpl } from './language_client_wrapper';
import { LanguageServerManager } from './language_server_manager';
import { LanguageClientFactory } from './client_factory';
import { LanguageServerFeatureStateProvider } from './language_server_feature_state_provider';

jest.mock('../code_suggestions/code_suggestions_gutter_icon');
jest.mock('../code_suggestions/code_suggestions_status_bar_item');
jest.mock('../code_suggestions/code_suggestions_state_manager');
jest.mock('./language_client_wrapper');
jest.mock('../code_suggestions/gitlab_platform_manager_for_code_suggestions');
jest.mock('../webview/setup_webviews');

describe('LanguageServerManager', () => {
  let triggerTelemetryChange: (enabled: boolean) => void;
  let clientWrapper: LanguageClientWrapperImpl;
  let platformManager: GitLabPlatformManagerForCodeSuggestionsImpl;
  let client: BaseLanguageClient;
  let languageClientFactory: LanguageClientFactory;
  let dependencyContainer: DependencyContainer;
  let stateManager: CodeSuggestionsStateManager;
  let context: vscode.ExtensionContext;
  let languageServerManager: LanguageServerManager;
  let webviewMessageRegistry: WebviewMessageRegistry;
  const triggerActiveTextEditorChange = createActiveTextEditorChangeTrigger();
  let languageServerFeatureStateProvider: LanguageServerFeatureStateProvider;
  let uninitializedLanguageServerManager: LanguageServerManager;
  let mockExtensionConfigurationService: ExtensionConfigurationService;
  let clientContext: IClientContext;

  beforeEach(async () => {
    clientWrapper = createFakePartial<LanguageClientWrapperImpl>({
      initAndStart: jest.fn(),
      sendSuggestionAcceptedEvent: jest.fn(),
      sendQuickChatOpenEvent: jest.fn(),
      sendQuickChatMessageEvent: jest.fn(),
      syncConfig: jest.fn(),
      dispose: jest.fn(),
    });
    clientContext = {
      ide: {
        name: 'Visual Studio Code',
        vendor: 'Microsoft Corporation',
        version: vscode.version,
      },
      extension: {
        name: 'GitLab Workflow',
        version: '6.0.0',
      },
    };

    mockExtensionConfigurationService = createFakePartial<ExtensionConfigurationService>({
      onChange: jest.fn(),
      getConfiguration: jest.fn().mockReturnValue({
        debug: false,
      }),
      dispose: jest.fn(),
    });

    platformManager = createFakePartial<GitLabPlatformManagerForCodeSuggestionsImpl>({
      getGitLabPlatform: jest.fn(),
      onAccountChange: jest.fn(),
      dispose: jest.fn(),
    });
    jest.mocked(LanguageClientWrapperImpl).mockReturnValue(clientWrapper);
    jest.mocked(GitLabPlatformManagerForCodeSuggestionsImpl).mockReturnValue(platformManager);

    client = createFakePartial<BaseLanguageClient>({
      stop: jest.fn(),
      sendNotification: jest.fn(),
      sendRequest: jest.fn(),
      onRequest: jest.fn(),
      onNotification: jest.fn(),
      initializeResult: {
        serverInfo: {
          version: '1.2.3',
        },
      },
    });

    languageClientFactory = createFakePartial<LanguageClientFactory>({
      createLanguageClient: jest.fn(() => client),
    });
    dependencyContainer = createFakePartial<DependencyContainer>({
      gitLabPlatformManager: {
        onAccountChange: jest.fn().mockReturnValue({
          dispose: jest.fn(),
        }),
      },
      gitLabTelemetryEnvironment: {
        isTelemetryEnabled: jest.fn(),
        onDidChangeTelemetryEnabled: jest.fn().mockImplementation(trigger => {
          triggerTelemetryChange = trigger;
          return {
            dispose: jest.fn(),
          };
        }),
      },
    });
    stateManager = createFakePartial<CodeSuggestionsStateManager>({
      init: jest.fn(),
      onDidChangeVisibleState: jest.fn(),
    });
    context = createExtensionContext();
    jest.mocked(CodeSuggestionsStateManager).mockReturnValue(stateManager);

    languageServerFeatureStateProvider = createFakePartial<LanguageServerFeatureStateProvider>({});

    webviewMessageRegistry = createFakePartial<WebviewMessageRegistry>({});
    languageServerManager = new LanguageServerManager(
      context,
      languageClientFactory,
      dependencyContainer,
      webviewMessageRegistry,
      languageServerFeatureStateProvider,
      clientContext,
    );

    // Set up the language client wrapper using the mocked version
    languageServerManager.setLanguageClientWrapper(clientWrapper);

    await languageServerManager.startLanguageServer();
  });

  it('does not do anything if language server is already started', async () => {
    await languageServerManager.startLanguageServer();
    expect(languageClientFactory.createLanguageClient).toHaveBeenCalledTimes(1);
  });

  it('creates a language client and provides a baseAssetsUrl', () => {
    expect(languageClientFactory.createLanguageClient).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        initializationOptions: expect.objectContaining({
          baseAssetsUrl: expect.stringContaining('/assets/language-server/'),
        }),
      }),
    );
  });

  it('uses custom clientContext when provided in constructor', async () => {
    const customClientContext: IClientContext = {
      ide: {
        name: 'GitLab Web IDE',
        vendor: 'GitLab',
        version: '1.94.0',
      },
      extension: {
        name: 'GitLab Workflow',
        version: '1.0.0',
      },
    };

    const customLanguageServerManager = new LanguageServerManager(
      context,
      languageClientFactory,
      dependencyContainer,
      webviewMessageRegistry,
      languageServerFeatureStateProvider,
      customClientContext,
    );

    customLanguageServerManager.setLanguageClientWrapper(clientWrapper);
    await customLanguageServerManager.startLanguageServer();

    expect(languageClientFactory.createLanguageClient).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        initializationOptions: expect.objectContaining({
          ...customClientContext,
          baseAssetsUrl: expect.stringContaining('/assets/language-server/'),
        }),
      }),
    );
  });

  it('initializes the language client wrapper', async () => {
    expect(clientWrapper.initAndStart).toHaveBeenCalled();
  });

  it('initializes state manager', async () => {
    expect(stateManager.init).toHaveBeenCalled();
  });

  it('registers suggestion accepted command', () => {
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      SUGGESTION_ACCEPTED_COMMAND,
      clientWrapper.sendSuggestionAcceptedEvent,
    );
  });

  it('registers streamed suggestion accepted command', () => {
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      CODE_SUGGESTION_STREAM_ACCEPTED_COMMAND,
      expect.any(Function),
    );
  });

  it('registers the command to toggle code suggestions on/off', () => {
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      COMMAND_TOGGLE_CODE_SUGGESTIONS,
      expect.any(Function),
    );
  });

  it('registers the command to show the quick pick menu', () => {
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      SHOW_QUICK_PICK_MENU,
      expect.any(Function),
    );
  });

  it('registers command for quick chat open telemetry', () => {
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      COMMAND_QUICK_CHAT_OPEN_TELEMETRY,
      expect.any(Function),
    );
  });

  it('registers command for quick chat message telemetry', () => {
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      COMMAND_QUICK_CHAT_MESSAGE_TELEMETRY,
      expect.any(Function),
    );
  });

  it('syncs config when configuration changes', () => {
    const mockConfig = createFakePartial<ExtensionConfiguration>({
      debug: true,
    });

    mockExtensionConfigurationService.onChange(clientWrapper.syncConfig);

    expect(mockExtensionConfigurationService.onChange).toHaveBeenCalledWith(
      clientWrapper.syncConfig,
    );

    const configChangeHandler = jest.mocked(mockExtensionConfigurationService.onChange).mock
      .calls[0][0];
    configChangeHandler(mockConfig);

    expect(clientWrapper.syncConfig).toHaveBeenCalled();
  });

  it('registers telemetry change listener', () => {
    triggerTelemetryChange(true);
    expect(clientWrapper.syncConfig).toHaveBeenCalled();
  });

  it('registers on account change listener', () => {
    expect(dependencyContainer.gitLabPlatformManager.onAccountChange).toHaveBeenCalledWith(
      clientWrapper.syncConfig,
    );
  });

  it('registers  change document in active editor', async () => {
    const uri = 'file://file.js';
    await triggerActiveTextEditorChange(
      createFakePartial<vscode.TextEditor>({ document: { uri } }),
    );
    expect(client.sendNotification).toHaveBeenCalledWith(DidChangeDocumentInActiveEditor, uri);
  });

  it('creates CodeSuggestionsGutterIcon', () => {
    expect(CodeSuggestionsGutterIcon).toHaveBeenCalledTimes(1);
    expect(CodeSuggestionsGutterIcon).toHaveBeenCalledWith(context, stateManager);
  });

  describe('getWebviewInfos', () => {
    it('returns webview infos', async () => {
      const mock = {
        id: 'mock',
        title: 'Foo',
        uris: ['file://foo'],
      };
      jest.mocked(client.sendRequest).mockResolvedValue([mock]);
      const webviewInfos = await languageServerManager.getWebviewInfos();
      expect(webviewInfos).toEqual([mock]);
    });
  });

  describe('publishWebviewTheme', () => {
    const theme: Theme = { styles: { '--editor-background': '#000000' } };

    it('sends a notification to the client with the provided theme', async () => {
      await languageServerManager.publishWebviewTheme(theme);
      expect(client.sendNotification).toHaveBeenCalledWith('$/gitlab/theme/didChangeTheme', theme);
    });

    it('throws an error if the client is not initialized', async () => {
      const uninitializedManager = new LanguageServerManager(
        context,
        languageClientFactory,
        dependencyContainer,
        webviewMessageRegistry,
        languageServerFeatureStateProvider,
        clientContext,
      );

      await expect(() => uninitializedManager.publishWebviewTheme(theme)).toThrow(
        'Language Server client is not initialized. Cannot publish webview theme.',
      );
    });
  });

  describe('setInitialState', () => {
    const initialState = { key: 'value' };
    it('sends a notification to the client with the initial state', async () => {
      await languageServerManager.setDuoWorkflowInitialState(initialState);

      expect(client.sendNotification).toHaveBeenCalledWith('$/gitlab/plugin/notification', {
        pluginId: DUO_WORKFLOW_PANEL_WEBVIEW_ID,
        type: 'setInitialState',
        payload: initialState,
      });
    });
  });

  describe('restartLanguageServer', () => {
    beforeEach(async () => {
      await languageServerManager.restartLanguageServer();
    });

    it('stops the existing client', () => {
      expect(client.stop).toHaveBeenCalled();
    });

    it('disposes the existing wrapper', () => {
      expect(clientWrapper.dispose).toHaveBeenCalled();
    });

    it('reinitializes the language server', () => {
      expect(languageClientFactory.createLanguageClient).toHaveBeenCalledTimes(2);
      expect(clientWrapper.initAndStart).toHaveBeenCalledTimes(2);
    });
  });

  describe('stopLanguageServer', () => {
    beforeEach(async () => {
      await languageServerManager.stopLanguageServer();
    });

    it('disposes the client wrapper ', () => {
      expect(clientWrapper.dispose).toHaveBeenCalled();
    });

    it('stops the existing client', () => {
      expect(client.stop).toHaveBeenCalledWith(5000);
    });
  });

  describe('sendRequest and sendNotification with uninitialized client', () => {
    beforeEach(async () => {
      uninitializedLanguageServerManager = new LanguageServerManager(
        context,
        languageClientFactory,
        dependencyContainer,
        webviewMessageRegistry,
        languageServerFeatureStateProvider,
        clientContext,
      );
    });

    it('sendRequest returns undefined if client is not initialized', async () => {
      const result = await uninitializedLanguageServerManager.sendRequest('testMethod');
      expect(result).toBeUndefined();
    });

    it('sendNotification returns undefined if client is not initialized', async () => {
      const result = await uninitializedLanguageServerManager.sendNotification('testNotification');
      expect(result).toBeUndefined();
    });
  });

  describe('sendRequest', () => {
    it('sends request to the client if initialized', async () => {
      const mockResponse = { data: 'test' };
      jest.mocked(client.sendRequest).mockResolvedValue(mockResponse);

      const result = await languageServerManager.sendRequest('testMethod', { param: 'value' });

      expect(client.sendRequest).toHaveBeenCalledWith('testMethod', { param: 'value' }, undefined);
      expect(result).toEqual(mockResponse);
    });

    it('passes cancellation token to the client', async () => {
      const mockToken = {} as vscode.CancellationToken;
      await languageServerManager.sendRequest('testMethod', { param: 'value' }, mockToken);

      expect(client.sendRequest).toHaveBeenCalledWith('testMethod', { param: 'value' }, mockToken);
    });
  });

  describe('sendNotification', () => {
    it('sends notification to the client if initialized', async () => {
      jest.mocked(client.sendNotification).mockResolvedValue(undefined);

      const result = await languageServerManager.sendNotification('testNotification', {
        param: 'value',
      });

      expect(client.sendNotification).toHaveBeenCalledWith('testNotification', { param: 'value' });
      expect(result).toBe(true);
    });
  });

  describe('version handling', () => {
    it('returns undefined when client is not initialized', () => {
      expect(uninitializedLanguageServerManager.version).toBe(undefined);
    });

    it('returns correct version when client is initialized', async () => {
      const versionChangeHandler = jest.fn();
      languageServerManager.onChange(versionChangeHandler);

      await languageServerManager.restartLanguageServer();

      expect(versionChangeHandler).toHaveBeenCalledWith({
        version: '1.2.3',
      });
      expect(languageServerManager.version).toBe('1.2.3');
    });
  });
});
