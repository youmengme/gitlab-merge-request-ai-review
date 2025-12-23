import vscode from 'vscode';
import { isNumber } from 'lodash';
import { LsWebviewController, WebviewControllerProps } from '../ls_webview_controller';
import { USER_COMMANDS } from '../../command_names';
import { CONFIG_NAMESPACE, DUO_CHAT_WEBVIEW_ID } from '../../constants';
import { getErrorScreenHtml } from '../../chat/error_screen';
import { handleError } from '../../errors/handle_error';
import { UserFriendlyError } from '../../errors/user_friendly_error';

const WAIT_TIMEOUT_MS = 10000;

export class LSDuoChatWebviewController extends LsWebviewController {
  #chatReady = false;

  constructor({ viewId, url, title, middlewares }: WebviewControllerProps) {
    super({ viewId, url, title, middlewares });
  }

  async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    try {
      await super.resolveWebviewView(webviewView);
      await this.#waitForChatReady();
    } catch (error) {
      this.#setErrorScreenContent(error.message);
      handleError(new UserFriendlyError(error.message, error));
    }
  }

  async show() {
    try {
      if (!this.view) {
        await vscode.commands.executeCommand(`gl.webview.${DUO_CHAT_WEBVIEW_ID}.focus`);
        await this.#waitForChatReady();
      } else if (!this.view.visible) {
        this.view.show();
      }
      // add small timeout to allow the chat to load
      // otherwise focus sometimes gets lost
      await new Promise(resolve => {
        setTimeout(resolve, 50);
      });
      await this.focusChat();
    } catch (error) {
      handleError(new UserFriendlyError(error.message, error));
    }
  }

  async hide() {
    if (this.view?.visible) {
      await vscode.commands.executeCommand('workbench.action.closeSidebar');
    }
  }

  async focusChat() {
    if (this.view?.visible) {
      await vscode.commands.executeCommand(USER_COMMANDS.FOCUS_CHAT);
    }
  }

  setChatReady() {
    this.#chatReady = true;
  }

  async #waitForChatReady(): Promise<void> {
    const timeoutSecondsSetting = vscode.workspace
      .getConfiguration(CONFIG_NAMESPACE)
      .get('webviewTimeoutSeconds');

    const timeoutMs = isNumber(timeoutSecondsSetting)
      ? timeoutSecondsSetting * 1000
      : WAIT_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
      const checkInterval = 200;
      const startTime = Date.now();

      const interval = setInterval(() => {
        if (this.#chatReady) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - startTime >= timeoutMs) {
          clearInterval(interval);
          reject(new Error(`The webview didn't initialize in ${timeoutMs}ms`));
        }
      }, checkInterval);
    });
  }

  #setErrorScreenContent(errorContent: string) {
    if (!this.view) {
      throw new Error('Chat view not initialized.');
    }

    const htmlErrorCont = getErrorScreenHtml(errorContent);
    this.view.webview.html = htmlErrorCont;
  }
}
