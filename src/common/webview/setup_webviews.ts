import * as vscode from 'vscode';
import {
  AGENTIC_CHAT_WEBVIEW_ID,
  DUO_CHAT_WEBVIEW_ID,
  DUO_WORKFLOW_PANEL_WEBVIEW_ID,
  SECURITY_VULNS_WEBVIEW_ID,
  AGENTIC_TABS_WEBVIEW_ID,
  MCP_DASHBOARD_WEBVIEW_ID,
  AGENT_PLATFORM_DUO_UI_NEXT_WEBVIEW_ID,
  FLOW_BUILDER_WEBVIEW_ID,
} from '../constants';

import { AIContextManager } from '../chat/ai_context_manager';
import { LsWebviewController } from './ls_webview_controller';
import { WebviewInfo } from './webview_info_provider';
import { WebviewThemePublisher } from './theme/types';
import { createThemeHandlerMiddleware } from './theme/create_theme_handler_middleware';
import { createInitialStateMiddleware } from './theme/create_initial_state_middleware';
import { getWebviewContent } from './get_ls_webview_content';
import { applyMiddleware } from './middleware';
import { registerDuoChatHandlers, WebviewId } from './duo_chat/duo_chat_handlers';
import { WebviewManager } from './webview_manager';
import { WebviewMessageRegistry } from './message_handlers';
import { registerDuoChatCommands } from './duo_chat/duo_chat_commands';
import { registerDuoAgenticChatCommands } from './duo_agentic_chat/duo_agentic_chat_commands';
import { LSDuoChatWebviewController } from './duo_chat/duo_chat_controller';
import { registerKnowledgeGraphHandlers } from './knowldege_graph/knowledge_graph_handler';
import { KnowledgeGraphWebview } from './knowldege_graph/knowledge_graph_webview';

const CHAT_WEBVIEW_IDS = [DUO_CHAT_WEBVIEW_ID, AGENTIC_CHAT_WEBVIEW_ID];

// webviews that show in the VS Code panels, sidebar or other custom views (like activity bar)
const PANEL_WEBVIEW_IDS = [
  ...CHAT_WEBVIEW_IDS,
  DUO_WORKFLOW_PANEL_WEBVIEW_ID,
  AGENTIC_TABS_WEBVIEW_ID,
  AGENT_PLATFORM_DUO_UI_NEXT_WEBVIEW_ID,
];

// webviews in the editor area (i.e. tabs)
const EDITOR_WEBVIEW_IDS = [
  SECURITY_VULNS_WEBVIEW_ID,
  MCP_DASHBOARD_WEBVIEW_ID,
  FLOW_BUILDER_WEBVIEW_ID,
];

// custom settings for webviews in the editor area
const EDITOR_WEBVIEW_SETTINGS: { [webviewId: string]: { viewColumn: vscode.ViewColumn } } = {
  [SECURITY_VULNS_WEBVIEW_ID]: {
    viewColumn: vscode.ViewColumn.Beside,
  },
  [FLOW_BUILDER_WEBVIEW_ID]: {
    viewColumn: vscode.ViewColumn.Beside,
  },
};

// converts webview kebab-case strings to camelCase for commands
const kebabToCamelCase = (str: string) =>
  str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

// converts path/case strings to dot.case strings for commands
const slashToDot = (str: string) => str.replace(/\//g, '.');

const normalizeWebviewStrings = (str: string) => slashToDot(kebabToCamelCase(str));

const setupKnowledgeGraphWebview = async (
  webviewMessageRegistry: WebviewMessageRegistry,
): Promise<vscode.Disposable> => {
  const webview = new KnowledgeGraphWebview();
  await registerKnowledgeGraphHandlers(webviewMessageRegistry, webview);
  return new vscode.Disposable(() => webview.dispose());
};

const setupEditorWebview = async (
  webviewInfo: WebviewInfo,
  themePublisher: WebviewThemePublisher,
): Promise<vscode.Disposable> => {
  const commandId = `gl.webview.${normalizeWebviewStrings(webviewInfo.id)}.show`;

  let panel: vscode.WebviewPanel | undefined;
  const disposables: vscode.Disposable[] = [];

  disposables.push(
    vscode.commands.registerCommand(
      `${commandId}`,
      async (initState: Record<string, unknown> = {}) => {
        const viewColumn =
          EDITOR_WEBVIEW_SETTINGS?.[webviewInfo.id]?.viewColumn ?? vscode.ViewColumn.One;
        const initialWorkspaceConfig = {};

        if (panel && Object.keys(initState).length === 0) {
          panel.reveal(viewColumn);
        } else {
          if (panel) {
            panel.dispose();
          }

          const initialState = {
            ...initState,
            ...initialWorkspaceConfig,
          };

          panel = vscode.window.createWebviewPanel(
            webviewInfo.id,
            webviewInfo.title,
            {
              viewColumn,
              preserveFocus: true,
            },
            {
              enableScripts: true,
              retainContextWhenHidden: true,
            },
          );

          const url = new URL(webviewInfo.uris[0]); // FIXME this is not the right way to pick the uri, this should be platform dependent
          if (typeof initState.uri === 'string') {
            url.searchParams.append('uri', initState.uri);
          }

          panel.webview.html = await getWebviewContent(url, webviewInfo.title);

          const middlewares = [
            createThemeHandlerMiddleware(themePublisher),
            createInitialStateMiddleware(themePublisher, initialState),
          ];

          applyMiddleware(panel, middlewares);

          panel.onDidDispose(() => {
            panel = undefined;
          });
        }
        return panel;
      },
    ),
  );

  return new vscode.Disposable(() => disposables.forEach(x => x.dispose()));
};

const setupPanelWebview = async (
  webviewInfo: WebviewInfo,
  themePublisher: WebviewThemePublisher,
  webviewMessageRegistry: WebviewMessageRegistry,
  aiContextManager: AIContextManager,
): Promise<vscode.Disposable> => {
  const viewId = `gl.webview.${slashToDot(webviewInfo.id)}`;
  const commandId = `${normalizeWebviewStrings(viewId)}.show`;

  const middlewares = [createThemeHandlerMiddleware(themePublisher)];

  const controllerParams = {
    viewId,
    url: new URL(webviewInfo.uris[0]), // FIXME this is not the right way to pick the uri, this should be platform dependent
    title: webviewInfo.title,
    middlewares,
  };

  const controller = CHAT_WEBVIEW_IDS.includes(webviewInfo.id)
    ? new LSDuoChatWebviewController(controllerParams)
    : new LsWebviewController(controllerParams);

  const disposables: vscode.Disposable[] = [];

  // FIXME: we should have a mechanism to restore webview state because VS Code prefers to destroy the web pages when they are not visible (the `retainContextWhenHidden` should be false)
  disposables.push(
    vscode.window.registerWebviewViewProvider(viewId, controller, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  disposables.push(
    vscode.commands.registerCommand(`${commandId}`, async () => {
      await controller.show();
    }),
  );

  if (CHAT_WEBVIEW_IDS.includes(webviewInfo.id)) {
    registerDuoChatHandlers(
      webviewMessageRegistry,
      controller as LSDuoChatWebviewController,
      webviewInfo.id as WebviewId,
    );
  }

  if (webviewInfo.id === DUO_CHAT_WEBVIEW_ID) {
    disposables.push(
      await registerDuoChatCommands(
        webviewMessageRegistry,
        controller as LSDuoChatWebviewController,
        aiContextManager,
      ),
    );
  }

  if (webviewInfo.id === AGENTIC_CHAT_WEBVIEW_ID) {
    disposables.push(
      await registerDuoAgenticChatCommands(
        webviewMessageRegistry,
        controller as LSDuoChatWebviewController,
      ),
    );
  }

  return new vscode.Disposable(() => disposables.forEach(x => x.dispose()));
};

export const setupWebviews = async (
  webviewManager: WebviewManager,
  webviewMessageRegistry: WebviewMessageRegistry,
  aiContextManager: AIContextManager,
): Promise<vscode.Disposable> => {
  const allInfos = await webviewManager.getWebviewInfos();
  const panelWebviewInfos = allInfos.filter(i => PANEL_WEBVIEW_IDS.includes(i.id));
  const editorWebviewInfos = allInfos.filter(i => EDITOR_WEBVIEW_IDS.includes(i.id));
  const disposables = await Promise.all([
    ...panelWebviewInfos.map(webviewInfo =>
      setupPanelWebview(webviewInfo, webviewManager, webviewMessageRegistry, aiContextManager),
    ),
    ...editorWebviewInfos.map(webviewInfo => setupEditorWebview(webviewInfo, webviewManager)),
    setupKnowledgeGraphWebview(webviewMessageRegistry),
  ]);

  return new vscode.Disposable(() => disposables.forEach(x => x.dispose()));
};
