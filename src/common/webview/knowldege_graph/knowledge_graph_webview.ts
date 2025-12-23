import * as vscode from 'vscode';
import { KNOWLEDGE_GRAPH_WEBVIEW_ID } from '../../constants';
import { getWebviewContent } from '../get_ls_webview_content';
import { log } from '../../log';

export const SHOW_KNOWLEDGE_GRAPH_WEBVIEW_COMMAND = 'gl.webview.knowledgeGraph.show';

export class KnowledgeGraphWebview implements vscode.Disposable {
  #command: vscode.Disposable | undefined;

  constructor() {
    this.#command = undefined;
  }

  async start(url: string) {
    if (this.#command) {
      return;
    }

    const knowledgeGraphUrl = this.#parseKnowledgeGraphUrl(url);
    if (!knowledgeGraphUrl) {
      return;
    }

    let panel: vscode.WebviewPanel | undefined;

    this.#command = vscode.commands.registerCommand(
      SHOW_KNOWLEDGE_GRAPH_WEBVIEW_COMMAND,
      async () => {
        if (panel) {
          panel.reveal(vscode.ViewColumn.One);
          return panel;
        }

        panel = vscode.window.createWebviewPanel(
          KNOWLEDGE_GRAPH_WEBVIEW_ID,
          'Knowledge Graph',
          {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true,
          },
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          },
        );

        panel.webview.html = await getWebviewContent(knowledgeGraphUrl, 'Knowledge Graph');

        panel.onDidDispose(() => {
          panel = undefined;
        });

        return panel;
      },
    );

    await vscode.commands.executeCommand('setContext', 'gitlab:knowledgeGraphReady', true);
  }

  dispose() {
    this.#command?.dispose();
  }

  #parseKnowledgeGraphUrl(url: string): URL | undefined {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(url);
    } catch (error) {
      log.error('Invalid URL provided to Knowledge Graph webview:', error);
      return undefined;
    }

    return parsedUrl;
  }
}
