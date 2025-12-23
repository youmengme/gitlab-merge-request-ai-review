import * as vscode from 'vscode';
import { log } from '../../log';
import { DUO_CHAT_WEBVIEW_ID, AGENTIC_CHAT_WEBVIEW_ID } from '../../constants';
import { getActiveFileContext } from '../../chat/gitlab_chat_file_context';
import { WebviewMessageRegistry } from '../message_handlers/webview_message_registry';
import { insertCodeSnippet as insertCodeSnippetFn } from '../../chat/insert_code_snippet';
import { copyContent } from '../../chat/copy_content';
import { LSDuoChatWebviewController } from './duo_chat_controller';

interface SnippetActionParams {
  snippet: string;
}

interface CopyMessageActionParams {
  message: string;
}

export const insertCodeSnippet = async (params: SnippetActionParams | unknown) => {
  const { snippet } = (params as SnippetActionParams) ?? {};
  if (snippet) {
    await insertCodeSnippetFn(snippet);
  }
};

export const copyCodeSnippet = async (params: SnippetActionParams | unknown) => {
  const { snippet } = (params as SnippetActionParams) ?? {};
  if (snippet) {
    await copyContent(snippet);
  }
};

export const copyMessage = async (params: CopyMessageActionParams | unknown) => {
  const { message } = (params as CopyMessageActionParams) ?? {};
  if (message) {
    await copyContent(message);
  }
};

export type MessageType = 'error' | 'warning' | 'info';

interface UserMessageParams {
  message: string;
  type: MessageType;
}

export const showUserMessage = async (params: UserMessageParams | unknown) => {
  const { type, message } = (params as UserMessageParams) ?? {};

  switch (type) {
    case 'error':
      await vscode.window.showErrorMessage(message);
      break;
    case 'warning':
      await vscode.window.showWarningMessage(message);
      break;
    case 'info':
      await vscode.window.showInformationMessage(message);
      break;
    default:
      log.warn(`Unsupported notification type: ${type}`);
  }
};

interface FocusStateParams {
  isFocused: boolean;
}

export const setChatFocusState = async (params: FocusStateParams | unknown) => {
  const { isFocused } = params as FocusStateParams;
  await vscode.commands.executeCommand('setContext', 'gitlab:chatFocused', isFocused);
};

interface OpenLinkParams {
  href?: string;
  url?: string;
}

/**
 * Duo Chat: Uses 'openLink' notification with 'href' parameter
 * Agentic Chat: Uses 'openUrl' notification with 'url' parameter
 *
 * Only `openUrl` will be left eventually but we keep `openLink` with `href`
 * to be compatible with other extensions that rely on that notification and args naming
 */
export const openLink = async (params: OpenLinkParams | unknown) => {
  const { href, url } = params as OpenLinkParams;
  const linkUrl = href || url;

  try {
    if (!linkUrl) return;

    const uri = vscode.Uri.parse(linkUrl);
    const result = await vscode.env.openExternal(uri);

    if (!result) {
      throw new Error(`Failed to open URL: ${linkUrl}`);
    }
  } catch (e) {
    log.warn(e.message);
  }
};
export type WebviewId = typeof DUO_CHAT_WEBVIEW_ID | typeof AGENTIC_CHAT_WEBVIEW_ID;

export const registerDuoChatHandlers = (
  registry: WebviewMessageRegistry,
  controller: LSDuoChatWebviewController,
  webviewId: WebviewId,
) => {
  registry.onRequest(webviewId, 'getCurrentFileContext', getActiveFileContext);

  registry.onNotification(webviewId, 'insertCodeSnippet', insertCodeSnippet);
  registry.onNotification(webviewId, 'copyCodeSnippet', copyCodeSnippet);
  registry.onNotification(webviewId, 'showMessage', showUserMessage);
  registry.onNotification(webviewId, 'focusChange', setChatFocusState);
  registry.onNotification(webviewId, 'appReady', () => controller.setChatReady());
  registry.onNotification(webviewId, 'openLink', openLink);
  registry.onNotification(webviewId, 'openUrl', openLink);
  registry.onNotification(webviewId, 'copyMessage', copyMessage);
};
