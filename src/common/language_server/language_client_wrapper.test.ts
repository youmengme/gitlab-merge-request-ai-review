import vscode, { TabGroup } from 'vscode';
import {
  DidChangeDocumentInActiveEditor,
  TRACKING_EVENTS,
  AiContextEditorRequests,
  FeatureStateChangeNotificationType,
  FeatureState,
} from '@gitlab-org/gitlab-lsp';
import {
  BaseLanguageClient,
  DidChangeConfigurationNotification,
  GenericNotificationHandler,
  NotificationType,
} from 'vscode-languageclient';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { GitLabPlatformManagerForCodeSuggestions } from '../code_suggestions/gitlab_platform_manager_for_code_suggestions';
import { GitLabPlatformForAccount } from '../platform/gitlab_platform';
import { gitlabPlatformForAccount, gitlabPlatformForProject } from '../test_utils/entities';
import { setFakeWorkspaceConfiguration } from '../test_utils/vscode_fakes';
import { asMutable } from '../test_utils/types';
import { GitLabTelemetryEnvironment } from '../platform/gitlab_telemetry_environment';
import { log } from '../log';
import {
  getLocalFeatureFlagService,
  LocalFeatureFlagService,
} from '../feature_flags/local_feature_flag_service';
import { LSGitProvider } from '../git/ls_git_provider';
import {
  WebviewMessageRegistry,
  handleWebviewNotification,
  handleWebviewRequest,
  DEFAULT_WEBVIEW_NOTIFICATION_METHOD,
  DEFAULT_WEBVIEW_REQUEST_METHOD,
} from '../webview';
import { QUICK_CHAT_OPEN_TRIGGER } from '../quick_chat/constants';
import { TerminalManager } from '../duo_workflow/terminal_manager';
import { LanguageClientWrapper, LanguageClientWrapperImpl } from './language_client_wrapper';
import { LanguageServerFeatureStateProvider } from './language_server_feature_state_provider';
import { FileSnapshotProvider } from './file_snapshot_provider';
import { GET_DIAGNOSTICS_REQUEST_METHOD } from './document_quality_handler';
import { RepositoryClient } from './repository_client';

jest.mock('../code_suggestions/gitlab_platform_manager_for_code_suggestions');
jest.mock('../log'); // disable logging in tests
jest.mock('../feature_flags/local_feature_flag_service');

jest.mock('../webview');

describe('LanguageClientWrapper', () => {
  let client: BaseLanguageClient;
  const getGitLabPlatformMock = jest.fn();
  const fakeManager = createFakePartial<GitLabPlatformManagerForCodeSuggestions>({
    getGitLabPlatform: getGitLabPlatformMock,
  });

  const gitLabTelemetryEnvironment = createFakePartial<GitLabTelemetryEnvironment>({
    isTelemetryEnabled: jest.fn(),
  });

  let lsGitProvider: LSGitProvider;

  let webviewMessageRegistry: WebviewMessageRegistry;

  let languageServerFeatureStateProvider: LanguageServerFeatureStateProvider;

  let terminalManager: TerminalManager;

  let fileSnapshotProvider: FileSnapshotProvider;

  let repositoryClient: RepositoryClient;

  let wrapper: LanguageClientWrapper;

  const createWrapper = (
    options: Partial<{
      mockClient: BaseLanguageClient;
      mockSuggestionsManager: GitLabPlatformManagerForCodeSuggestions;
      mockTelemetryEnvironment: GitLabTelemetryEnvironment;
      mockLsGitProvider: LSGitProvider;
      mockWebviewMessageRegistry: WebviewMessageRegistry;
      mockFeatureStateManager: LanguageServerFeatureStateProvider;
      mockTerminalManager: TerminalManager;
      mockFileSnapshotProvider: FileSnapshotProvider;
      mockRepositoryClient: RepositoryClient;
    }> = {},
  ) => {
    const {
      mockClient = client,
      mockSuggestionsManager = fakeManager,
      mockTelemetryEnvironment = gitLabTelemetryEnvironment,
      mockLsGitProvider = lsGitProvider,
      mockWebviewMessageRegistry = webviewMessageRegistry,
      mockFeatureStateManager = languageServerFeatureStateProvider,
      mockTerminalManager = terminalManager,
      mockFileSnapshotProvider = fileSnapshotProvider,
      mockRepositoryClient = repositoryClient,
    } = options;

    return new LanguageClientWrapperImpl(
      mockClient,
      mockSuggestionsManager,
      mockTelemetryEnvironment,
      mockLsGitProvider,
      mockWebviewMessageRegistry,
      mockFeatureStateManager,
      mockTerminalManager,
      mockFileSnapshotProvider,
      mockRepositoryClient,
    );
  };

  beforeEach(() => {
    const gitLabPlatform: GitLabPlatformForAccount = gitlabPlatformForAccount;
    getGitLabPlatformMock.mockResolvedValue(gitLabPlatform);
    client = createFakePartial<BaseLanguageClient>({
      start: jest.fn(),
      stop: jest.fn(),
      registerProposedFeatures: jest.fn(),
      onNotification: jest.fn(),
      sendNotification: jest.fn(),
      sendRequest: jest.fn(),
      onRequest: jest.fn(),
    });
    lsGitProvider = createFakePartial<LSGitProvider>({
      getDiffWithHead: jest.fn(),
      getDiffWithBranch: jest.fn(),
    });
    jest
      .mocked(getLocalFeatureFlagService)
      .mockReturnValue(createFakePartial<LocalFeatureFlagService>({ isEnabled: () => true }));

    webviewMessageRegistry = createFakePartial<WebviewMessageRegistry>({
      initNotifier: jest.fn(),
      initRequester: jest.fn(),
    });

    languageServerFeatureStateProvider = createFakePartial<LanguageServerFeatureStateProvider>({
      setStates: jest.fn(),
    });

    terminalManager = createFakePartial<TerminalManager>({
      setupRequests: jest.fn(),
      dispose: jest.fn(),
    });

    fileSnapshotProvider = createFakePartial<FileSnapshotProvider>({});

    repositoryClient = createFakePartial<RepositoryClient>({
      setRequestFunction: jest.fn(),
      handleRepositoriesChanged: jest.fn(),
      getRepositories: jest.fn(),
      onRepositoriesChanged: jest.fn(),
    });
  });

  afterEach(() => {
    wrapper.dispose();
  });

  describe('initAndStart', () => {
    it('starts the client and synchronizes the configuration', async () => {
      wrapper = createWrapper();

      await wrapper.initAndStart();

      expect(client.registerProposedFeatures).toHaveBeenCalled();
      expect(client.start).toHaveBeenCalled();
      expect(client.sendNotification).toHaveBeenCalledWith(
        DidChangeConfigurationNotification.type,
        {
          settings: {
            baseUrl: gitlabPlatformForAccount.account.instanceUrl,
            projectPath: '',
            token: gitlabPlatformForAccount.account.token,
            telemetry: {
              actions: [{ action: TRACKING_EVENTS.SHOWN }, { action: TRACKING_EVENTS.ACCEPTED }],
            },
            featureFlags: {
              codeSuggestionsClientDirectToGateway: true,
              duoWorkflowBinary: true,
              editFileDiagnosticsResponse: true,
              remoteSecurityScans: true,
              streamCodeGenerations: true,
              useDuoChatUiForFlow: true,
            },
            codeCompletion: {
              enabled: true,
              additionalLanguages: [],
              disabledSupportedLanguages: [],
            },
            securityScannerOptions: {
              enabled: false,
            },
            openTabsContext: true,
            suggestionsCache: undefined,
            logLevel: 'info',
            ignoreCertificateErrors: false,
            httpAgentOptions: {
              ca: undefined,
              cert: undefined,
              certKey: undefined,
            },
            duo: {
              enabledWithoutGitLabProject: undefined,
              workflow: {
                graph: undefined,
              },
              agentPlatform: {
                enabled: true,
                connectionType: 'websocket',
              },
            },
            duoChat: {
              enabled: true,
            },
          },
        },
      );
    });

    it('sends empty token when there is no account', async () => {
      getGitLabPlatformMock.mockResolvedValue(undefined);
      wrapper = createWrapper();

      await wrapper.initAndStart();

      expect(client.sendNotification).toHaveBeenCalledWith(
        DidChangeConfigurationNotification.type,
        {
          settings: { token: '' },
        },
      );
    });

    it('stops client when disposed', async () => {
      wrapper = createWrapper();

      await wrapper.initAndStart();
      wrapper.dispose();

      expect(client.stop).toHaveBeenCalled();
    });

    describe('sendOpenTabs', () => {
      describe('with no open tabs', () => {
        it('does not send and "textDocument/didOpen" events', async () => {
          wrapper = createWrapper();

          await wrapper.initAndStart();

          expect(client.sendNotification).not.toHaveBeenCalledWith(
            expect.objectContaining({
              method: 'textDocument/didOpen',
            }),
            expect.anything(),
          );
        });
      });

      describe('with tab groups and open tabs', () => {
        beforeEach(() => {
          const mockTextDocuments = [
            createFakePartial<vscode.TextDocument>({
              uri: vscode.Uri.file('/path/to/file1.ts'),
              getText: () => '',
            }),
            createFakePartial<vscode.TextDocument>({
              uri: vscode.Uri.file('/path/to/file2.ts'),
              getText: () => '',
            }),
            createFakePartial<vscode.TextDocument>({
              uri: vscode.Uri.file('/path/to/file3.ts'),
              getText: () => '',
            }),
          ];

          jest.mocked(vscode.workspace.openTextDocument).mockImplementation(uri => {
            let textDocument: vscode.TextDocument | undefined;
            if (uri instanceof vscode.Uri) {
              textDocument = mockTextDocuments.find(doc => doc.uri.path === uri.path);
            } else if (typeof uri === 'string') {
              textDocument = mockTextDocuments.find(doc => doc.uri.path === uri);
            }
            return Promise.resolve(textDocument!);
          });

          asMutable(vscode.window.tabGroups).all = [
            createFakePartial<TabGroup>({
              tabs: [
                createFakePartial<vscode.Tab>({
                  input: new vscode.TabInputText(vscode.Uri.file('/path/to/file1.ts')),
                }),
                createFakePartial<vscode.Tab>({
                  input: new vscode.TabInputText(vscode.Uri.file('/path/to/file2.ts')),
                }),
              ],
            }),
            createFakePartial<TabGroup>({
              tabs: [
                createFakePartial<vscode.Tab>({
                  input: new vscode.TabInputText(vscode.Uri.file('/path/to/file3.ts')),
                }),
                createFakePartial<vscode.Tab>({
                  input: createFakePartial<vscode.TabInputTextDiff>({
                    original: '/path/to/file4.ts',
                  }),
                }),
              ],
            }),
          ];
        });

        afterEach(() => {
          asMutable(vscode.window.tabGroups).all = [];
        });

        it('logs an error when accessing tabs fails', async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          asMutable(vscode.window.tabGroups).all = null as any; // Force an invalid vscode state

          wrapper = createWrapper();

          await wrapper.initAndStart();

          expect(log.error).toHaveBeenCalledWith(
            'Failed to send existing open tabs to language server: ',
            expect.any(Error),
          );
        });

        it('logs a warning when sending a document fails', async () => {
          const error = new Error(`oh no!`);
          jest.mocked(vscode.workspace.openTextDocument).mockImplementation(uri => {
            if (uri instanceof vscode.Uri && uri.path === '/path/to/file1.ts') {
              throw error;
            }
            return Promise.resolve(createFakePartial<vscode.TextDocument>({}));
          });
          wrapper = createWrapper();

          await wrapper.initAndStart();

          expect(log.warn).toHaveBeenCalledWith(
            'Failed to send "textDocument.didOpen" event for "file:///path/to/file1.ts"',
            error,
          );
        });

        it('sends "textDocument/didOpen" event for each open document', async () => {
          wrapper = createWrapper();

          await wrapper.initAndStart();

          expect(client.sendNotification).toHaveBeenCalledWith(
            expect.objectContaining({
              method: 'textDocument/didOpen',
            }),
            { textDocument: expect.objectContaining({ uri: 'file:///path/to/file1.ts' }) },
          );
          expect(client.sendNotification).toHaveBeenCalledWith(
            expect.objectContaining({
              method: 'textDocument/didOpen',
            }),
            { textDocument: expect.objectContaining({ uri: 'file:///path/to/file2.ts' }) },
          );
          expect(client.sendNotification).toHaveBeenCalledWith(
            expect.objectContaining({
              method: 'textDocument/didOpen',
            }),
            { textDocument: expect.objectContaining({ uri: 'file:///path/to/file3.ts' }) },
          );
        });

        it('does not send "textDocument/didOpen" event for unsupported document types', async () => {
          wrapper = createWrapper();

          await wrapper.initAndStart();

          expect(client.sendNotification).not.toHaveBeenCalledWith(
            expect.objectContaining({
              method: 'textDocument/didOpen',
            }),
            { textDocument: expect.objectContaining({ original: '/path/to/file4.ts' }) },
          );
        });
      });
    });

    describe('sendActiveDocument', () => {
      const activeEditorDocumentFileUri = 'file://file.js';

      beforeEach(async () => {
        vscode.window.activeTextEditor = createFakePartial<vscode.TextEditor>({
          document: { uri: activeEditorDocumentFileUri },
        });

        wrapper = createWrapper();

        await wrapper.initAndStart();
      });

      it('send DidChangeDocumentInActiveEditor event', async () => {
        expect(client.sendNotification).toHaveBeenCalledWith(
          DidChangeDocumentInActiveEditor,
          activeEditorDocumentFileUri,
        );
      });
    });

    describe('inside a GitLab project', () => {
      beforeEach(() => {
        getGitLabPlatformMock.mockResolvedValue(gitlabPlatformForProject);

        client = createFakePartial<BaseLanguageClient>({
          start: jest.fn(),
          stop: jest.fn(),
          registerProposedFeatures: jest.fn(),
          onNotification: jest.fn(),
          onRequest: jest.fn(),
          sendNotification: jest.fn(),
        });
      });

      it('sends the project path', async () => {
        wrapper = createWrapper();

        await wrapper.initAndStart();

        expect(client.sendNotification).toHaveBeenCalledWith(
          DidChangeConfigurationNotification.type,
          {
            settings: expect.objectContaining({
              projectPath: gitlabPlatformForProject.project?.namespaceWithPath,
            }),
          },
        );
      });
    });

    it('registers applyEdit handler', async () => {
      wrapper = createWrapper();

      await wrapper.initAndStart();

      expect(client.onRequest).toHaveBeenCalledWith('workspace/applyEdit', expect.any(Function));
    });

    it('registers GET_DIAGNOSTICS_REQUEST_METHOD handler', async () => {
      wrapper = createWrapper();

      await wrapper.initAndStart();

      expect(client.onRequest).toHaveBeenCalledWith(
        GET_DIAGNOSTICS_REQUEST_METHOD,
        expect.any(Function),
      );
    });

    describe('registers webviews-related notifications', () => {
      it('registers handlers for DEFAULT_WEBVIEW_REQUEST_METHOD and DEFAULT_WEBVIEW_NOTIFICATION_METHOD', async () => {
        const mockRequestHandler = jest.fn();
        const mockNotificationHandler = jest.fn();

        jest.mocked(handleWebviewRequest).mockReturnValue(mockRequestHandler);
        jest.mocked(handleWebviewNotification).mockReturnValue(mockNotificationHandler);

        wrapper = createWrapper();

        await wrapper.initAndStart();

        expect(client.onRequest).toHaveBeenCalledWith(
          DEFAULT_WEBVIEW_REQUEST_METHOD,
          mockRequestHandler,
        );
        expect(client.onNotification).toHaveBeenCalledWith(
          DEFAULT_WEBVIEW_NOTIFICATION_METHOD,
          mockNotificationHandler,
        );
      });

      it('initializes the webview message registry notifier', async () => {
        wrapper = createWrapper();

        await wrapper.initAndStart();

        expect(webviewMessageRegistry.initNotifier).toHaveBeenCalledWith(expect.any(Function));

        const notifierFunction = jest.mocked(webviewMessageRegistry.initNotifier).mock.calls[0][0];
        const testMessage = { type: 'test', payload: 'data' };
        await notifierFunction(testMessage);

        expect(client.sendNotification).toHaveBeenCalledWith(
          DEFAULT_WEBVIEW_NOTIFICATION_METHOD,
          testMessage,
        );
      });

      it('initializes the webview message registry requester', async () => {
        wrapper = createWrapper();

        await wrapper.initAndStart();

        expect(webviewMessageRegistry.initRequester).toHaveBeenCalledWith(expect.any(Function));

        const requesterFunction = jest.mocked(webviewMessageRegistry.initRequester).mock
          .calls[0][0];
        const testMessage = { type: 'test', payload: 'data' };
        await requesterFunction(testMessage);

        expect(client.sendRequest).toHaveBeenCalledWith(
          DEFAULT_WEBVIEW_REQUEST_METHOD,
          testMessage,
        );
      });
    });

    describe('Feature State Manager notification', () => {
      const notificationHandlers: Map<
        NotificationType<unknown> | string,
        GenericNotificationHandler
      > = new Map();

      beforeEach(async () => {
        jest.mocked(client.onNotification).mockImplementation((type, handler) => {
          notificationHandlers.set(type, handler);
          return {
            dispose: () => {},
          };
        });

        wrapper = createWrapper();
        await wrapper.initAndStart();
      });

      it('sets feature manager states when receiving "FeatureStateChangeNotification"', async () => {
        const notificationPayload = createFakePartial<FeatureState[]>([]);
        notificationHandlers.get(FeatureStateChangeNotificationType)?.(notificationPayload);

        expect(languageServerFeatureStateProvider.setStates).toHaveBeenLastCalledWith(
          notificationPayload,
        );
      });
    });

    describe('Repository Client Setup', () => {
      it('should set up repository client with generic request function', async () => {
        wrapper = createWrapper();

        await wrapper.initAndStart();

        expect(repositoryClient.setRequestFunction).toHaveBeenCalledWith(expect.any(Function));
      });

      it('should create repository request function that calls client.sendRequest with correct parameters', async () => {
        const mockResponse = { data: 'test response' };
        jest.mocked(client.sendRequest).mockResolvedValue(mockResponse);

        wrapper = createWrapper();
        await wrapper.initAndStart();

        // Get the function that was passed to setRequestFunction
        const setRequestFunctionCall = jest.mocked(repositoryClient.setRequestFunction).mock
          .calls[0];
        const repositoryRequestFunction = setRequestFunctionCall[0];

        // Test the function with typed parameters
        const testMethod = '$/gitlab/testMethod';
        const testParams = { param1: 'value1', param2: 42 };

        const result = await repositoryRequestFunction(testMethod, testParams);

        expect(client.sendRequest).toHaveBeenCalledWith(testMethod, testParams);
        expect(result).toBe(mockResponse);
      });
    });

    describe('Terminal Manager', () => {
      it('calls setup on the terminal manager', async () => {
        wrapper = createWrapper();
        await wrapper.initAndStart();

        expect(terminalManager.setupRequests).toHaveBeenCalledWith(client);
      });
    });
  });

  describe('sendSuggestionAcceptedEvent', () => {
    it('sends accepted notification', async () => {
      wrapper = createWrapper();

      // this is important step, we reference the function WITHOUT it's class instance
      // to test that we can pass it around as a command
      const { sendSuggestionAcceptedEvent } = wrapper;

      const trackingId = 'trackingId';
      const optionId = 1;

      await sendSuggestionAcceptedEvent(trackingId, optionId);

      expect(client.sendNotification).toHaveBeenCalledWith('$/gitlab/telemetry', {
        category: 'code_suggestions',
        action: TRACKING_EVENTS.ACCEPTED,
        context: { trackingId, optionId },
      });
    });
  });

  describe('sendQuickChatOpenEvent', () => {
    it('sends quick chat open notification with SHORTCUT trigger', async () => {
      wrapper = createWrapper();
      const { sendQuickChatOpenEvent } = wrapper;

      await sendQuickChatOpenEvent({ trigger: QUICK_CHAT_OPEN_TRIGGER.SHORTCUT });

      expect(client.sendNotification).toHaveBeenCalledWith('$/gitlab/telemetry', {
        category: 'gitlab_quick_chat',
        action: 'open_quick_chat',
        context: { trigger: 'shortcut' },
      });
    });

    it('sends quick chat open notification with CODE_ACTION_FIX_WITH_DUO trigger', async () => {
      wrapper = createWrapper();
      const { sendQuickChatOpenEvent } = wrapper;

      await sendQuickChatOpenEvent({ trigger: QUICK_CHAT_OPEN_TRIGGER.CODE_ACTION_FIX_WITH_DUO });

      expect(client.sendNotification).toHaveBeenCalledWith('$/gitlab/telemetry', {
        category: 'gitlab_quick_chat',
        action: 'open_quick_chat',
        context: { trigger: 'code_action_fix_with_duo' },
      });
    });

    it('sends quick chat open notification with CLICK trigger', async () => {
      wrapper = createWrapper();
      const { sendQuickChatOpenEvent } = wrapper;

      await sendQuickChatOpenEvent({ trigger: QUICK_CHAT_OPEN_TRIGGER.CLICK });

      expect(client.sendNotification).toHaveBeenCalledWith('$/gitlab/telemetry', {
        category: 'gitlab_quick_chat',
        action: 'open_quick_chat',
        context: { trigger: 'click_button' },
      });
    });
  });

  describe('syncConfig', () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      await wrapper.initAndStart();

      // initAndStart() will trigger some mocks, so let's start from a clean slate
      jest.clearAllMocks();
    });

    it('reads featureFlags configuration', async () => {
      jest
        .mocked(getLocalFeatureFlagService)
        .mockReturnValue(createFakePartial<LocalFeatureFlagService>({ isEnabled: () => false }));

      await wrapper.syncConfig();

      expect(client.sendNotification).toHaveBeenCalledTimes(1);
      expect(client.sendNotification).toHaveBeenCalledWith(
        DidChangeConfigurationNotification.type,
        {
          settings: expect.objectContaining({
            featureFlags: {
              codeSuggestionsClientDirectToGateway: false,
              duoWorkflowBinary: false,
              editFileDiagnosticsResponse: false,
              remoteSecurityScans: false,
              streamCodeGenerations: false,
              useDuoChatUiForFlow: false,
            },
          }),
        },
      );
    });

    it('includes platformClientConfig when set', async () => {
      const customConfig = {
        baseUrl: 'https://custom.gitlab.com',
        token: 'custom-token',
        projectPath: 'custom/project',
      };
      wrapper.setCustomPlatformConfig(customConfig);

      await wrapper.syncConfig();

      expect(client.sendNotification).toHaveBeenCalledWith(
        DidChangeConfigurationNotification.type,
        {
          settings: expect.objectContaining({
            baseUrl: 'https://custom.gitlab.com',
            token: 'custom-token',
            projectPath: 'custom/project',
          }),
        },
      );
    });

    it('prioritizes platformClientConfig over default configuration', async () => {
      const customConfig = {
        baseUrl: 'https://override.gitlab.com',
        logLevel: 'debug' as const,
      };
      wrapper.setCustomPlatformConfig(customConfig);

      await wrapper.syncConfig();

      expect(client.sendNotification).toHaveBeenCalledWith(
        DidChangeConfigurationNotification.type,
        {
          settings: expect.objectContaining({
            baseUrl: 'https://override.gitlab.com',
            logLevel: 'debug',
          }),
        },
      );
    });

    describe('syncs telemetry configuration', () => {
      it.each([true, false])('when telemetry enabled is set to %s', async isTelemetryEnabled => {
        jest
          .mocked(gitLabTelemetryEnvironment.isTelemetryEnabled)
          .mockReturnValueOnce(isTelemetryEnabled);

        await wrapper.syncConfig();

        expect(client.sendNotification).toHaveBeenCalledWith(
          DidChangeConfigurationNotification.type,
          {
            settings: expect.objectContaining({
              telemetry: expect.objectContaining({
                enabled: isTelemetryEnabled,
              }),
            }),
          },
        );
      });
    });

    describe.each`
      configured                                | expected
      ${{ ignoreCertificateErrors: false }}     | ${{ ignoreCertificateErrors: false }}
      ${{ ignoreCertificateErrors: null }}      | ${{ ignoreCertificateErrors: false }}
      ${{ ignoreCertificateErrors: true }}      | ${{ ignoreCertificateErrors: true }}
      ${{ ignoreCertificateErrors: undefined }} | ${{ ignoreCertificateErrors: false }}
      ${{ ca: 'test-ca' }}                      | ${{ httpAgentOptions: { ca: 'test-ca' } }}
      ${{ cert: 'test-cert' }}                  | ${{ httpAgentOptions: { cert: 'test-cert' } }}
      ${{ certKey: 'test-certKey' }}            | ${{ httpAgentOptions: { certKey: 'test-certKey' } }}
    `('$expected when workspace included $configured', ({ configured, expected }) => {
      it('should send a configuration changed notification', async () => {
        setFakeWorkspaceConfiguration(configured);

        await wrapper.syncConfig();

        expect(client.sendNotification).toHaveBeenCalledWith(
          DidChangeConfigurationNotification.type,
          {
            settings: expect.objectContaining(expected),
          },
        );
      });
    });
  });

  describe('git diff request handling', () => {
    let requestHandlers: Record<string, (...args: unknown[]) => unknown>;

    beforeEach(async () => {
      requestHandlers = {};
      jest.mocked(client.onRequest).mockImplementation((type, handler) => {
        requestHandlers[type] = handler;
        return {
          dispose: () => {},
        };
      });

      wrapper = createWrapper();
      await wrapper.initAndStart();
    });

    it('registers git diff request handler', () => {
      expect(client.onRequest).toHaveBeenCalledWith(
        AiContextEditorRequests.GIT_DIFF,
        expect.any(Function),
      );
    });

    it('registers get editor selection request handler', () => {
      expect(client.onRequest).toHaveBeenCalledWith(
        AiContextEditorRequests.EDITOR_SELECTION,
        expect.any(Function),
      );
    });

    describe('when requesting diff with HEAD', () => {
      const repositoryUri = 'file:///path/to/repo';
      const expectedDiff = 'diff --git a/file.txt b/file.txt';

      beforeEach(() => {
        jest.mocked(lsGitProvider.getDiffWithHead).mockResolvedValue(expectedDiff);
      });

      it('returns diff from LSGitProvider', async () => {
        const result = await requestHandlers[AiContextEditorRequests.GIT_DIFF]({
          repositoryUri,
        });

        expect(result).toBe(expectedDiff);
        expect(lsGitProvider.getDiffWithHead).toHaveBeenCalledWith(vscode.Uri.parse(repositoryUri));
      });
    });

    describe('when requesting diff with specific branch', () => {
      const repositoryUri = 'file:///path/to/repo';
      const branch = 'feature-branch';
      const expectedDiff = 'diff --git a/file.txt b/file.txt';

      beforeEach(() => {
        jest.mocked(lsGitProvider.getDiffWithBranch).mockResolvedValue(expectedDiff);
      });

      it('returns diff from LSGitProvider', async () => {
        const result = await requestHandlers[AiContextEditorRequests.GIT_DIFF]({
          repositoryUri,
          branch,
        });

        expect(result).toBe(expectedDiff);
        expect(lsGitProvider.getDiffWithBranch).toHaveBeenCalledWith(
          vscode.Uri.parse(repositoryUri),
          branch,
        );
      });
    });
  });
});
