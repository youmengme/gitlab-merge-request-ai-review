import * as vscode from 'vscode';
import {
  DUO_CHAT_WEBVIEW_ID,
  AGENTIC_CHAT_WEBVIEW_ID,
  DUO_WORKFLOW_PANEL_WEBVIEW_ID,
  SECURITY_VULNS_WEBVIEW_ID,
} from '../constants';

import { createFakePartial } from '../test_utils/create_fake_partial';
import { AIContextManager } from '../chat/ai_context_manager';
import { setupWebviews } from './setup_webviews';
import { LsWebviewController } from './ls_webview_controller';
import { getWebviewContent } from './get_ls_webview_content';
import { applyMiddleware } from './middleware';
import { createThemeHandlerMiddleware } from './theme/create_theme_handler_middleware';
import { createInitialStateMiddleware } from './theme/create_initial_state_middleware';
import { WebviewManager } from './webview_manager';
import { WebviewMessageRegistry } from './message_handlers/webview_message_registry';
import { registerDuoChatHandlers } from './duo_chat/duo_chat_handlers';
import { registerDuoChatCommands } from './duo_chat/duo_chat_commands';
import { registerDuoAgenticChatCommands } from './duo_agentic_chat/duo_agentic_chat_commands';
import { LSDuoChatWebviewController } from './duo_chat/duo_chat_controller';
import { registerKnowledgeGraphHandlers } from './knowldege_graph/knowledge_graph_handler';
import { KnowledgeGraphWebview } from './knowldege_graph/knowledge_graph_webview';

jest.mock('./middleware');
jest.mock('./get_ls_webview_content');
jest.mock('./theme/create_theme_handler_middleware');
jest.mock('./theme/create_initial_state_middleware');
jest.mock('./ls_webview_controller');
jest.mock('./duo_chat/duo_chat_handlers');
jest.mock('./duo_chat/duo_chat_commands');
jest.mock('./duo_agentic_chat/duo_agentic_chat_commands');
jest.mock('./knowldege_graph/knowledge_graph_handler');
jest.mock('./knowldege_graph/knowledge_graph_webview');

jest.mock('vscode', () => ({
  window: {
    createWebviewPanel: jest.fn(),
    registerWebviewViewProvider: jest.fn(),
  },
  commands: {
    registerCommand: jest.fn(),
  },
  ViewColumn: {
    One: 1,
    Beside: -2,
  },
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn(),
  })),
  workspace: {
    onDidChangeConfiguration: jest.fn(),
    getConfiguration: jest.fn().mockReturnValue({
      debug: false,
      get: jest.fn(),
    }),
  },
  env: {
    asExternalUri: jest.fn(),
  },
  Uri: {
    parse: jest.fn(),
  },
  Disposable: jest.fn(),
}));

describe('setupWebviews', () => {
  let webviewManager: WebviewManager;
  let webview: vscode.Webview;
  let panel: vscode.WebviewPanel | undefined;
  let webviewMessageRegistry: WebviewMessageRegistry;
  let aiContextManager: AIContextManager;

  const revealSpy = jest.fn();
  const onDidDisposeSpy = jest.fn();
  const disposeSpy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    webviewMessageRegistry = createFakePartial<WebviewMessageRegistry>({
      onNotification: jest.fn(),
      onRequest: jest.fn(),
      initNotifier: jest.fn(),
      initRequester: jest.fn(),
    });

    webviewManager = {
      getWebviewInfos: jest.fn().mockResolvedValue([]),
      publishWebviewTheme: jest.fn(),
      setDuoWorkflowInitialState: jest.fn(),
    };

    aiContextManager = createFakePartial<AIContextManager>({
      add: jest.fn(),
    });

    webview = {} as vscode.Webview;
    panel = {
      webview,
      dispose: disposeSpy,
      onDidDispose: onDidDisposeSpy,
      reveal: revealSpy,
    } as unknown as vscode.WebviewPanel;
    vscode.window.createWebviewPanel = jest.fn().mockReturnValue(panel);
  });

  describe('for the panel webviews', () => {
    it('should setup panel webviews correctly', async () => {
      webviewManager.getWebviewInfos = jest.fn().mockResolvedValue([
        {
          id: DUO_CHAT_WEBVIEW_ID,
          title: 'Duo Chat',
          uris: ['https://example.com/duo-chat'],
        },
      ]);

      const disposable = await setupWebviews(
        webviewManager,
        webviewMessageRegistry,
        aiContextManager,
      );

      expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledTimes(1);
      expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(1);
      expect(LsWebviewController).toHaveBeenCalledTimes(1);
      expect(disposable).toBeDefined();
    });

    it('should create show command for panel webviews', async () => {
      webviewManager.getWebviewInfos = jest.fn().mockResolvedValue([
        {
          id: DUO_CHAT_WEBVIEW_ID,
          title: 'Duo Chat',
          uris: ['https://example.com/duo-chat'],
        },
      ]);

      await setupWebviews(webviewManager, webviewMessageRegistry, aiContextManager);

      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        'gl.webview.duoChatV2.show',
        expect.any(Function),
      );
    });
  });

  describe('for the editor webviews', () => {
    const editorWebviewInfo = {
      id: SECURITY_VULNS_WEBVIEW_ID,
      title: 'Security Vulnerabilities',
      uris: ['https://example.com/security-vulns'],
    };
    let showCommandHandler: (initialState?: Record<string, unknown>) => Promise<void>;

    beforeEach(async () => {
      webviewManager.getWebviewInfos = jest.fn().mockResolvedValue([editorWebviewInfo]);
      vscode.env.asExternalUri = jest.fn().mockResolvedValue({
        toString: () => editorWebviewInfo.uris[0],
      } as vscode.Uri);
      await setupWebviews(webviewManager, webviewMessageRegistry, aiContextManager);

      const [, handler] = jest.mocked(vscode.commands.registerCommand).mock.calls[0];
      showCommandHandler = handler;
    });

    it('should register the correct command', async () => {
      webviewManager.getWebviewInfos = jest.fn().mockResolvedValue([editorWebviewInfo]);

      const disposable = await setupWebviews(
        webviewManager,
        webviewMessageRegistry,
        aiContextManager,
      );

      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        `gl.webview.securityVulnDetails.show`,
        expect.any(Function),
      );
      expect(disposable).toBeDefined();
    });

    it('should create webview panel with correct parameters when show command is executed', async () => {
      jest.mocked(getWebviewContent).mockResolvedValue('<html>Mock Content</html>');
      await showCommandHandler();
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        editorWebviewInfo.id,
        editorWebviewInfo.title,
        {
          viewColumn: -2,
          preserveFocus: true,
        },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        },
      );
    });

    it('should set correct HTML content for the webview', async () => {
      jest.mocked(getWebviewContent).mockResolvedValue('<html>Mock Content</html>');
      await showCommandHandler();

      expect(getWebviewContent).toHaveBeenCalledWith(
        new URL(editorWebviewInfo.uris[0]),
        editorWebviewInfo.title,
      );
      expect(webview.html).toBe('<html>Mock Content</html>');
    });

    it('should apply correct middlewares', async () => {
      await showCommandHandler();

      expect(createThemeHandlerMiddleware).toHaveBeenCalledWith(webviewManager);
      expect(createInitialStateMiddleware).toHaveBeenCalledWith(webviewManager, {
        type: undefined,
      });
      expect(applyMiddleware).toHaveBeenCalledWith(panel, expect.any(Array));
    });

    it('should return a disposable', async () => {
      const result = await setupWebviews(webviewManager, webviewMessageRegistry, aiContextManager);

      expect(result).toBeInstanceOf(vscode.Disposable);
    });

    it('calls the onDidDispose method', async () => {
      await showCommandHandler();
      expect(onDidDisposeSpy).toHaveBeenCalled();
    });

    describe('when the panel already exists', () => {
      beforeEach(async () => {
        panel = undefined;
        webviewManager.getWebviewInfos = jest.fn().mockResolvedValue([editorWebviewInfo]);
        await setupWebviews(webviewManager, webviewMessageRegistry, aiContextManager);
      });

      describe('and there is an initialState', () => {
        const initialState = { foo: 'bar' };
        beforeEach(async () => {
          await showCommandHandler(initialState);
        });

        it('should dispose of the existing panel', async () => {
          expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
          expect(disposeSpy).not.toHaveBeenCalled();

          await showCommandHandler(initialState);
          expect(disposeSpy).toHaveBeenCalled();
        });

        it('should not reveal an existing panel', () => {
          expect(revealSpy).not.toHaveBeenCalled();
        });
      });

      describe('and there are no initialState', () => {
        beforeEach(async () => {
          await showCommandHandler();
        });

        it('should reuse the existing panel', async () => {
          expect(revealSpy).not.toHaveBeenCalled();
          expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);

          webviewManager.getWebviewInfos = jest.fn().mockResolvedValue([editorWebviewInfo]);
          await setupWebviews(webviewManager, webviewMessageRegistry, aiContextManager);
          await showCommandHandler();

          expect(revealSpy).toHaveBeenCalled();
          expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  it('should correctly setup both panel and editor webviews when there are both', async () => {
    webviewManager.getWebviewInfos = jest.fn().mockResolvedValue([
      {
        id: DUO_CHAT_WEBVIEW_ID,
        title: 'Duo Chat',
        uris: ['https://example.com/duo-chat'],
      },
      {
        id: SECURITY_VULNS_WEBVIEW_ID,
        title: 'Security Vulnerabilities',
        uris: ['https://example.com/security-vulns'],
      },
      {
        id: DUO_WORKFLOW_PANEL_WEBVIEW_ID,
        title: 'GitLab Duo Agent Platform',
        uris: ['https://example.com/duo-workflow-panel'],
      },
    ]);

    const disposable = await setupWebviews(
      webviewManager,
      webviewMessageRegistry,
      aiContextManager,
    );

    expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(3);
    expect(jest.mocked(vscode.commands.registerCommand).mock.calls).toEqual([
      [`gl.webview.duoChatV2.show`, expect.any(Function)],
      [`gl.webview.duoWorkflowPanel.show`, expect.any(Function)],
      [`gl.webview.securityVulnDetails.show`, expect.any(Function)],
    ]);
    expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledTimes(2);
    expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
      `gl.webview.${DUO_CHAT_WEBVIEW_ID}`,
      expect.anything(),
      {
        webviewOptions: { retainContextWhenHidden: true },
      },
    );
    expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
      `gl.webview.${DUO_WORKFLOW_PANEL_WEBVIEW_ID}`,
      expect.anything(),
      {
        webviewOptions: { retainContextWhenHidden: true },
      },
    );

    expect(LsWebviewController).toHaveBeenCalledTimes(2);
    expect(LsWebviewController).toHaveBeenCalledWith(
      expect.objectContaining({ viewId: `gl.webview.${DUO_CHAT_WEBVIEW_ID}` }),
    );

    expect(disposable).toBeDefined();
  });

  it('should handle empty webview infos', async () => {
    webviewManager.getWebviewInfos = jest.fn().mockResolvedValue([]);

    const disposable = await setupWebviews(
      webviewManager,
      webviewMessageRegistry,
      aiContextManager,
    );

    expect(vscode.window.registerWebviewViewProvider).not.toHaveBeenCalled();
    expect(vscode.commands.registerCommand).not.toHaveBeenCalled();
    expect(LsWebviewController).not.toHaveBeenCalled();
    expect(disposable).toBeDefined();
  });

  it('should handle custom settings for webview', async () => {
    webviewManager.getWebviewInfos = jest.fn().mockResolvedValue([
      {
        id: SECURITY_VULNS_WEBVIEW_ID,
        title: 'GitLab SAST Remote Scanner',
        uris: ['https://example.com/security-vuln-details'],
      },
    ]);
    await setupWebviews(webviewManager, webviewMessageRegistry, aiContextManager);
    const showCommandHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1];
    await showCommandHandler();
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      SECURITY_VULNS_WEBVIEW_ID,
      'GitLab SAST Remote Scanner',
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );
  });

  it('should create webview panel when show command is executed for editor webviews', async () => {
    const htmlContent = '<h1>Foo Bar</h1>';
    jest.mocked(getWebviewContent).mockResolvedValue(htmlContent);

    webviewManager.getWebviewInfos = jest.fn().mockResolvedValue([
      {
        id: SECURITY_VULNS_WEBVIEW_ID,
        title: 'Security Vulnerabilities',
        uris: ['https://example.com/security-vulns'],
      },
    ]);

    await setupWebviews(webviewManager, webviewMessageRegistry, aiContextManager);

    const showCommandHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1];
    await showCommandHandler();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      SECURITY_VULNS_WEBVIEW_ID,
      'Security Vulnerabilities',
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
      },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    expect(webview.html).toBe(htmlContent);
  });

  describe('Duo Chat message handlers and commands', () => {
    beforeEach(() => {
      jest.mocked(webviewManager.getWebviewInfos).mockResolvedValue([
        {
          id: DUO_CHAT_WEBVIEW_ID,
          title: 'Duo Chat',
          uris: ['https://example.com/duo-chat'],
        },
        {
          id: AGENTIC_CHAT_WEBVIEW_ID,
          title: 'GitLab Duo Agentic Chat',
          uris: ['https://example.com/agentic-duo-chat'],
        },
      ]);
    });

    it('should register Duo chat messages in the registry', async () => {
      await setupWebviews(webviewManager, webviewMessageRegistry, aiContextManager);
      expect(jest.mocked(registerDuoChatHandlers).mock.calls).toEqual([
        [webviewMessageRegistry, expect.any(LSDuoChatWebviewController), DUO_CHAT_WEBVIEW_ID],
        [webviewMessageRegistry, expect.any(LSDuoChatWebviewController), AGENTIC_CHAT_WEBVIEW_ID],
      ]);
    });

    it('should register Duo chat commands', async () => {
      await setupWebviews(webviewManager, webviewMessageRegistry, aiContextManager);

      expect(registerDuoChatCommands).toHaveBeenCalledWith(
        webviewMessageRegistry,
        expect.any(LSDuoChatWebviewController),
        aiContextManager,
      );
    });

    it('should register Duo Agentic Chat commands', async () => {
      await setupWebviews(webviewManager, webviewMessageRegistry, aiContextManager);

      expect(registerDuoAgenticChatCommands).toHaveBeenCalledWith(
        webviewMessageRegistry,
        expect.any(LSDuoChatWebviewController),
      );
    });
  });

  describe('for the knowledge graph webview', () => {
    it('should setup knowledge graph webview', async () => {
      webviewManager.getWebviewInfos = jest.fn().mockResolvedValue([]);

      await setupWebviews(webviewManager, webviewMessageRegistry, aiContextManager);

      expect(KnowledgeGraphWebview).toHaveBeenCalledTimes(1);
      expect(registerKnowledgeGraphHandlers).toHaveBeenCalledWith(
        webviewMessageRegistry,
        expect.any(KnowledgeGraphWebview),
      );
    });
  });
});
