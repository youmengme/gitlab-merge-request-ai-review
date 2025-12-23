import * as vscode from 'vscode';
import { isNumber } from 'lodash';
import { AIContextCategory, AIContextItem } from '@gitlab-org/gitlab-lsp';
import { waitForWebview } from '../utils/webviews/wait_for_webview';
import { log } from '../log';
import { prepareWebviewSource } from '../utils/webviews/prepare_webview_source';
import { CONFIG_NAMESPACE } from '../constants';
import { GitLabChatRecord } from './gitlab_chat_record';
import { defaultSlashCommands } from './gitlab_chat_slash_commands';
import type { GitlabChatSlashCommand } from './gitlab_chat_slash_commands';
import { getErrorScreenHtml } from './error_screen';

export const CHAT_SIDEBAR_VIEW_ID = 'gl.chatView';

interface RecordCommand {
  eventType: 'newRecord' | 'updateRecord';
  record: GitLabChatRecord;
}

interface ClearChatCommand {
  eventType: 'clearChat';
}

interface SetLoadingStateCommand {
  eventType: 'setLoadingState';
  isLoading: boolean;
}

interface CancelPrompt {
  eventType: 'cancelPrompt';
  canceledPromptRequestIds: string[];
}

interface FocusChatCommand {
  eventType: 'focusChat';
}

interface ContextCategoriesResult {
  eventType: 'contextCategoriesResult';
  categories: AIContextCategory[];
}

interface ContextCurrentItemsResult {
  eventType: 'contextCurrentItemsResult';
  items: AIContextItem[];
}

interface ContextItemSearchResult {
  eventType: 'contextItemSearchResult';
  results: AIContextItem[];
  errorMessage?: string;
}

export type ViewCommand =
  | RecordCommand
  | ClearChatCommand
  | SetLoadingStateCommand
  | CancelPrompt
  | FocusChatCommand
  | ContextCategoriesResult
  | ContextCurrentItemsResult
  | ContextItemSearchResult;

interface ClearChatMessage {
  eventType: 'clearChat';
  record: {
    content: string;
  };
}

interface NewPromptMessage {
  eventType: 'newPrompt';
  record: {
    content: string;
  };
}

interface CancelPromptMessage {
  eventType: 'cancelPrompt';
  canceledPromptRequestId: string;
}

interface FeedbackMessage {
  eventType: 'trackFeedback';
  data?: {
    improveWhat: string | null;
    didWhat: string | null;
    feedbackChoices: string[] | null;
  };
}

interface InsertCodeSnippetMessage {
  eventType: 'insertCodeSnippet';
  data?: {
    snippet: string | null;
  };
}

interface ContextItemSearchQueryMessage {
  eventType: 'contextItemSearchQuery';
  query: {
    query: string;
    category: AIContextCategory;
  };
}

interface ContextItemAddedMessage {
  eventType: 'contextItemAdded';
  item: AIContextItem;
}

interface ContextItemRemovedMessage {
  eventType: 'contextItemRemoved';
  item: AIContextItem;
}

interface ContextItemGetContent {
  eventType: 'contextItemGetContent';
  item: AIContextItem;
  messageId?: string;
}

interface IsChatFocusedMessage {
  eventType: 'isChatFocused';
  isChatFocused: boolean;
}

interface WebViewInitialStateInterface {
  slashCommands: GitlabChatSlashCommand[];
}

export type ViewEmittedMessage =
  | NewPromptMessage
  | FeedbackMessage
  | ClearChatMessage
  | InsertCodeSnippetMessage
  | CancelPromptMessage
  | ContextItemSearchQueryMessage
  | ContextItemAddedMessage
  | ContextItemRemovedMessage
  | ContextItemGetContent
  | IsChatFocusedMessage;

export class GitLabChatView {
  #context: vscode.ExtensionContext;

  #chatView?: vscode.WebviewView;

  #messageEmitter = new vscode.EventEmitter<ViewEmittedMessage>();

  onViewMessage = this.#messageEmitter.event;

  #visibilityEmitter = new vscode.EventEmitter<void>();

  onDidBecomeVisible = this.#visibilityEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.#context = context;
  }

  async resolveWebviewView(webviewView: vscode.WebviewView) {
    this.#chatView = webviewView;

    this.#chatView.webview.options = {
      enableScripts: true,
    };

    const initialState: WebViewInitialStateInterface = {
      slashCommands: defaultSlashCommands,
    };

    this.#chatView.webview.html = await prepareWebviewSource(
      this.#chatView.webview,
      this.#context,
      'gitlab_duo_chat',
      undefined,
      initialState,
    );

    const timeoutSecondsSetting = vscode.workspace
      .getConfiguration(CONFIG_NAMESPACE)
      .get('webviewTimeoutSeconds');
    const timeoutMs = isNumber(timeoutSecondsSetting) ? timeoutSecondsSetting * 1000 : undefined;

    if (timeoutMs) log.info(`Setting Duo Chat webview timeout to ${timeoutMs}ms`);
    await waitForWebview(this.#chatView.webview, timeoutMs);

    this.#chatView.webview.onDidReceiveMessage(m => this.#messageEmitter.fire(m));
    this.#chatView.onDidChangeVisibility(() => {
      if (this.#chatView?.visible) this.#visibilityEmitter.fire();
    });

    this.#chatView.onDidDispose(() => {
      this.#chatView = undefined;
    }, this);
  }

  setErrorScreenContent(errorContent: string) {
    if (!this.#chatView) {
      throw new Error('Chat view not initialized.');
    }

    const htmlErrorCont = getErrorScreenHtml(errorContent);
    this.#chatView.webview.html = htmlErrorCont;
  }

  async show() {
    if (!this.#chatView) {
      await vscode.commands.executeCommand(`${CHAT_SIDEBAR_VIEW_ID}.focus`);
      return;
    }

    if (this.#chatView.visible) {
      await this.focusChat();
    } else {
      this.#chatView.show();
      await waitForWebview(this.#chatView.webview);
    }
  }

  async hide() {
    if (this.#chatView?.visible) {
      await vscode.commands.executeCommand('workbench.action.closeSidebar');
    }
  }

  // send message to webview to focus on the chat prompt
  async focusChat() {
    await this.#sendChatViewCommand({ eventType: 'focusChat' });
  }

  async clearChat() {
    await this.#sendChatViewCommand({ eventType: 'clearChat' });
  }

  async cancelPrompt(canceledPromptRequestIds: string[]) {
    await this.#sendChatViewCommand({
      eventType: 'cancelPrompt',
      canceledPromptRequestIds,
    });
  }

  async addRecord(record: GitLabChatRecord) {
    await this.#sendChatViewCommand({
      eventType: 'newRecord',
      record,
    });
  }

  async updateRecord(record: GitLabChatRecord) {
    await this.#sendChatViewCommand({
      eventType: 'updateRecord',
      record,
    });
  }

  async setLoadingState(isLoading: boolean) {
    await this.#sendChatViewCommand({
      eventType: 'setLoadingState',
      isLoading,
    });
  }

  async setContextItemCategories(categories: Array<AIContextCategory>) {
    await this.#sendChatViewCommand({
      eventType: 'contextCategoriesResult',
      categories,
    });
  }

  async setCurrentContextItems(items: Array<AIContextItem>) {
    await this.#sendChatViewCommand({
      eventType: 'contextCurrentItemsResult',
      items,
    });
  }

  async setContextItemSearchResults(results: Array<AIContextItem>) {
    await this.#sendChatViewCommand({
      eventType: 'contextItemSearchResult',
      results,
    });
  }

  async #sendChatViewCommand(message: ViewCommand) {
    if (!this.#chatView) {
      log.warn('Trying to send webview chat message without a webview.');
      return;
    }

    await this.#chatView.webview.postMessage(message);
  }

  // set vscode context whether the chat is focused or not
  async setChatFocused(isFocused: boolean) {
    await vscode.commands.executeCommand('setContext', 'gitlab:chatFocused', isFocused);
  }
}
