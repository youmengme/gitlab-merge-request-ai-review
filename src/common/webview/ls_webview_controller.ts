import * as vscode from 'vscode';
import { log } from '../log';
import { doNotAwait } from '../utils/do_not_await';
import { getWebviewContent } from './get_ls_webview_content';
import { applyMiddleware, WebviewContainerMiddleware } from './middleware';

export type WebviewControllerProps = {
  viewId: string;
  url: URL;
  title: string;
  description?: string;
  middlewares?: WebviewContainerMiddleware[];
};

export class LsWebviewController implements vscode.WebviewViewProvider {
  protected viewId: string;

  #url: URL;

  #title: string;

  protected view: vscode.WebviewView | undefined;

  #middlewares: WebviewContainerMiddleware[];

  constructor({ viewId, url, title, middlewares }: WebviewControllerProps) {
    this.viewId = viewId;
    this.#url = url;
    this.#title = title;
    this.#middlewares = middlewares ?? [];
  }

  async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    this.view = webviewView;
    this.view.webview.options = {
      enableScripts: true,
    };

    this.view.title = this.#title;

    doNotAwait(
      this.#isUrlAvailble(this.#url).then(isAvailable =>
        log.debug(`${this.viewId} url is ${isAvailable ? '' : 'not '}available`),
      ),
    );

    this.view.webview.html = await getWebviewContent(this.#url, this.view.title);

    if (this.#middlewares.length > 0) {
      applyMiddleware(this.view, this.#middlewares);
    }
  }

  async show() {
    if (this.view) {
      if (!this.view.visible) {
        this.view.show();
      }
    } else {
      await vscode.commands.executeCommand(`${this.viewId}.focus`);
    }
  }

  async #isUrlAvailble(url: URL, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      return response.ok;
    } catch (error) {
      log.error(`Error checking ${this.viewId} url: ${url}`);
      return false;
    } finally {
      clearTimeout(timeoutId);
      controller.abort();
    }
  }
}
