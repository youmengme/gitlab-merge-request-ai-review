import * as vscode from 'vscode';
import { WorkspaceFolder } from 'vscode-languageclient';
import { AIContextCategory, AIContextItem, AIContextItemMetadata } from '@gitlab-org/gitlab-lsp';
import { log } from '../log';
import { AiCompletionResponseMessageType } from '../api/graphql/ai_completion_response_channel';
import { versionRequest } from '../gitlab/check_version';
import { handleError } from '../errors/handle_error';
import { UserFriendlyError } from '../errors/user_friendly_error';
import { GitLabChatRecord, detectType } from './gitlab_chat_record';
import { GitLabChatView, ViewEmittedMessage } from './gitlab_chat_view';
import { GitLabChatApi } from './gitlab_chat_api';
import { GitLabPlatformManagerForChat } from './get_platform_manager_for_chat';
import { submitFeedback } from './utils/submit_feedback';
import { AIContextManager } from './ai_context_manager';
import { insertCodeSnippet } from './insert_code_snippet';

export class GitLabChatController implements vscode.WebviewViewProvider {
  readonly chatHistory: GitLabChatRecord[];

  readonly #canceledPromptRequestIds: string[];

  readonly #view: GitLabChatView;

  readonly #api: GitLabChatApi;

  readonly #manager: GitLabPlatformManagerForChat;

  readonly #aiContextManager: AIContextManager;

  constructor(
    manager: GitLabPlatformManagerForChat,
    context: vscode.ExtensionContext,
    aiContextManager: AIContextManager,
  ) {
    this.chatHistory = [];
    this.#canceledPromptRequestIds = [];
    this.#api = new GitLabChatApi(manager, this.#canceledPromptRequestIds, aiContextManager);
    this.#view = new GitLabChatView(context);
    this.#view.onViewMessage(this.viewMessageHandler.bind(this));
    this.#view.onDidBecomeVisible(this.#restoreHistory.bind(this));
    this.#manager = manager;
    this.#aiContextManager = aiContextManager;
  }

  async resolveWebviewView(webviewView: vscode.WebviewView) {
    try {
      await this.#view.resolveWebviewView(webviewView);
      await this.#restoreHistory();
    } catch (error) {
      this.#view.setErrorScreenContent(error);
      const userMessage = `Failed to initialize chat webview: ${error.message}`;
      handleError(new UserFriendlyError(userMessage, error));
    }
  }

  async viewMessageHandler(message: ViewEmittedMessage) {
    switch (message.eventType) {
      case 'newPrompt': {
        const record = await GitLabChatRecord.buildWithContext(
          {
            role: 'user',
            content: message.record.content,
            type: detectType(
              message.record.content,
              await this.getGitLabVersionForClear(this.#manager),
            ),
          },
          this.#aiContextManager,
        );

        await Promise.all([this.processNewUserRecord(record), this.#clearSelectedContextItems()]);
        break;
      }
      case 'cancelPrompt': {
        this.#canceledPromptRequestIds.push(message.canceledPromptRequestId);
        await this.#view.cancelPrompt(this.#canceledPromptRequestIds);
        break;
      }
      case 'isChatFocused': {
        await this.#view.setChatFocused(message.isChatFocused);
        break;
      }
      case 'trackFeedback': {
        if (message.data) {
          const gitlabEnvironment = await this.#manager.getGitLabEnvironment();

          await submitFeedback({
            didWhat: message.data.didWhat,
            improveWhat: message.data.improveWhat,
            feedbackChoices: message.data.feedbackChoices,
            gitlabEnvironment,
          });
        }

        break;
      }
      case 'insertCodeSnippet': {
        if (message.data && message.data.snippet) {
          await insertCodeSnippet(message.data.snippet);
        }

        break;
      }
      case 'contextItemSearchQuery': {
        const { category, query } = message.query;
        await this.#searchContextItems(category, query);
        break;
      }
      case 'contextItemAdded': {
        await this.#addContextItem(message.item);
        break;
      }
      case 'contextItemRemoved': {
        await this.#removeContextItem(message.item);
        break;
      }
      case 'contextItemGetContent': {
        await this.#getContextItemContent(message.item, message.messageId);
        break;
      }
      default:
        log.warn(`Unhandled chat-webview message: "${JSON.stringify(message)}"`);
        break;
    }
  }

  async openChat() {
    await this.#view.show();
  }

  async closeChat() {
    await this.#view.hide();
  }

  async focusChat() {
    await this.#view.focusChat();
  }

  async processNewUserRecord(record: GitLabChatRecord) {
    if (!record.content) {
      log.warn('Duo Chat: no content to send to API');
      return;
    }

    await this.#view.show();

    let useFallback: boolean = false;

    // establish a websocket connection before sending the message to the API
    // this is ensure that we avoid race conditions
    const subscribeToUpdatesResult = await this.#subscribeToUpdates(record);
    const aiActionResult = await this.#aiAction(record);

    const { cable, error: subscriptionError } = subscribeToUpdatesResult;
    const { actionResponse, error: actionError } = aiActionResult;

    if (!actionResponse) {
      if (cable) {
        cable.disconnect();
      }
      const apiResponseMessage = actionError
        ? (actionError.response?.errors?.[0]?.message ?? actionError.message)
        : 'No action response';
      const userMessage = `Failed to send the chat message to the API: ${apiResponseMessage}`;
      record.update({ errors: [userMessage] });
      log.error(actionError);
      handleError(new Error(userMessage));
      return;
    }

    if (subscriptionError) {
      log.error('Duo Chat: error subscribing to updates, using fallback', subscriptionError);
      useFallback = true;
    }

    record.update(actionResponse.aiAction);

    await this.#addToChat(record);

    if (record.type === 'newConversation') return;

    if (record.type === 'clearChat') {
      await this.#clearChatWindow();
      return;
    }

    const responseRecord = new GitLabChatRecord({
      role: 'assistant',
      state: 'pending',
      requestId: record.requestId,
    });
    await this.#addToChat(responseRecord);

    // Fallback if websocket fails or disabled.
    // Used in the Web IDE.
    if (useFallback) {
      log.error('Duo Chat: error connecting to cable socket, refreshing feed via https.');
      await Promise.all([this.#refreshRecord(record), this.#refreshRecord(responseRecord)]);
    }
  }

  async #aiAction(record: GitLabChatRecord) {
    try {
      const actionResponse = await this.#api.processNewUserPrompt(
        record.content as string,
        record.id,
        record.context?.currentFile,
        record.extras?.contextItems,
      );

      return { actionResponse, error: null };
    } catch (err) {
      return { actionResponse: null, error: err };
    }
  }

  async #subscribeToUpdates(record: GitLabChatRecord) {
    try {
      const cable = await this.#api.subscribeToUpdates(
        this.#subscriptionUpdateHandler.bind(this),
        record.id,
      );
      log.info('Duo Chat: successfully subscribed to updates');
      return { cable, error: null };
    } catch (err) {
      return { cable: null, error: err as Error };
    }
  }

  async #subscriptionUpdateHandler(data: AiCompletionResponseMessageType) {
    const record = this.#findRecord(data);

    if (!record) return;

    record.update({
      chunkId: data.chunkId,
      content: data.content,
      extras: {
        sources: data.extras?.sources ?? [],
        contextItems: data.extras?.additionalContext?.map(context => ({
          // graphql returns 'FILE' and 'SNIPPET'
          // but the type expects 'file' and 'snippet'
          // FIXME: make all internal types uppercase to match GraphQL
          // https://gitlab.com/gitlab-org/gitlab/-/issues/490824
          category: context.category.toLowerCase() as AIContextCategory,
          content: context.content,
          id: context.id,
          metadata: context.metadata as AIContextItemMetadata,
        })),
      },
      timestamp: data.timestamp,
      errors: data.errors,
    });

    record.state = 'ready';
    await this.#view.updateRecord(record);
  }

  async #restoreHistory() {
    if (this.#canceledPromptRequestIds.length) {
      await this.#view.cancelPrompt(this.#canceledPromptRequestIds);
    }

    await this.#refreshContextCategories();
    await this.#refreshCurrentContextItems();

    this.chatHistory.forEach(async record => {
      await this.#view.addRecord(record);
    }, this);
  }

  async #addToChat(record: GitLabChatRecord) {
    this.chatHistory.push(record);
    await this.#view.addRecord(record);
  }

  async #clearChatWindow() {
    try {
      const [res] = await Promise.all([this.#api.clearChat(), this.#clearSelectedContextItems()]);
      if (res.aiAction.errors.length > 0) {
        await vscode.window.showErrorMessage(res.aiAction.errors.join(', '));
      } else {
        // we have to clean the view and reset the user input.
        // Ideally, this should be done by re-fetching messages from API
        // which should return empty array. However, we don't have a way to fetch
        // messages yet. Will be handled aas part of https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/1065
        // Hence for now we handle it on the client
        await this.#view.clearChat();
        this.chatHistory.length = 0;
      }
    } catch (err) {
      log.error(err.toString());
      await vscode.window.showErrorMessage(err.toString());
    }
  }

  async #refreshRecord(record: GitLabChatRecord) {
    if (!record.requestId) {
      throw Error('requestId must be present!');
    }

    const apiResponse = await this.#api.pullAiMessage(record.requestId, record.role);

    if (apiResponse.type !== 'error') {
      record.update({
        content: apiResponse.content,
        extras: {
          sources: apiResponse.extras?.sources ?? [],
          contextItems: apiResponse.extras?.additionalContext?.map(context => ({
            category: context.category as AIContextCategory,
            content: context.content,
            id: context.id,
            metadata: context.metadata as AIContextItemMetadata,
          })),
        },
        timestamp: apiResponse.timestamp,
      });
    }

    record.update({ errors: apiResponse.errors, state: 'ready' });
    await this.#view.updateRecord(record);
  }

  #findRecord(data: { requestId: string; role: string }) {
    return this.chatHistory.find(
      r => r.requestId === data.requestId && r.role.toLowerCase() === data.role.toLowerCase(),
    );
  }

  get aiContextManager() {
    return this.#aiContextManager;
  }

  async #clearSelectedContextItems() {
    try {
      await this.#aiContextManager.clearSelectedContextItems();
      await this.#refreshCurrentContextItems();
    } catch (error) {
      log.debug(`ContextItems: error clearing selected context items`, error);
    }
  }

  async #getCurrentWorkspaceFolders(): Promise<WorkspaceFolder[]> {
    log.info(`ContextItems: getting current workspace folders`);
    const workspaceFolders =
      vscode.workspace.workspaceFolders?.map(folder => ({
        uri: folder.uri.toString(),
        name: folder.name,
      })) ?? [];
    // FIXME: Show a UI warning if no workspace folders are found
    // https://gitlab.com/gitlab-org/gitlab/-/issues/489300
    if (workspaceFolders.length === 0) {
      log.warn(`ContextItems: no workspace folders found`);
      await vscode.window.showWarningMessage(
        'No workspace folders found. Please open a folder to use this feature.',
      );
    }
    return workspaceFolders;
  }

  async #searchContextItems(category: AIContextCategory, query: string) {
    log.info(`ContextItems: searching ${JSON.stringify({ category, query })}`);
    const workspaceFolders = await this.#getCurrentWorkspaceFolders();
    try {
      const results = await this.#aiContextManager.query({
        workspaceFolders,
        query,
        category,
      });
      log.info(`ContextItems: found ${results.length} results`);
      await this.#view.setContextItemSearchResults(results);
    } catch (error) {
      // FIXME: Show a UI warning if there's an error
      // https://gitlab.com/gitlab-org/gitlab/-/issues/489300
      log.error(`ContextItems: error searching for context items`, error);
      await vscode.window.showErrorMessage('Error searching for context items');
    }
  }

  /**
   * note: we don't show an error message here because this feature is opt-in
   * and this call is made when the user opens the panel
   */
  async #refreshContextCategories() {
    log.info(`ContextItems: refreshing categories`);
    try {
      const availableCategories = await this.#aiContextManager.getAvailableCategories();
      await this.#view.setContextItemCategories(availableCategories);
    } catch (error) {
      // FIXME: Show a UI warning if there's an error
      // https://gitlab.com/gitlab-org/gitlab/-/issues/489300
      log.debug(`ContextItems: error refreshing categories`, error);
    }
  }

  /**
   * note: we don't show an error message here because this feature is opt-in
   * and this call is made when the user opens the panel
   */
  async #refreshCurrentContextItems() {
    log.info(`ContextItems: refreshing current context item selections`);
    try {
      const currentItems = await this.#aiContextManager.getCurrentItems();
      await this.#view.setCurrentContextItems(currentItems);
    } catch (error) {
      // FIXME: Show a UI warning if there's an error
      // https://gitlab.com/gitlab-org/gitlab/-/issues/489300
      log.debug(`ContextItems: error refreshing current items`, error);
    }
  }

  async #addContextItem(contextItem: AIContextItem) {
    try {
      await this.#aiContextManager.add(contextItem);
      await this.#refreshCurrentContextItems();
    } catch (error) {
      // FIXME: Show a UI warning if there's an error
      // https://gitlab.com/gitlab-org/gitlab/-/issues/489300
      log.error(`ContextItems: error adding context item`, error);
      await vscode.window.showErrorMessage('Error adding context item');
    }
  }

  async #removeContextItem(contextItem: AIContextItem) {
    log.info(`ContextItems: removing context item: ${JSON.stringify({ contextItem })}`);
    try {
      await this.#aiContextManager.remove(contextItem);
      await this.#refreshCurrentContextItems();
    } catch (error) {
      // FIXME: Show a UI warning if there's an error
      // https://gitlab.com/gitlab-org/gitlab/-/issues/489300
      log.error(`ContextItems: error removing context item`, error);
      await vscode.window.showErrorMessage('Error removing context item');
    }
  }

  async #getContextItemContent(contextItem: AIContextItem, messageId: string | undefined) {
    log.info(
      `ContextItems: getting context item content. contextItem: ${JSON.stringify({ contextItem })}, messageId: ${messageId}`,
    );
    try {
      const hydratedContextItem = await this.#aiContextManager.getItemWithContent(contextItem);

      // If there is no messageId, we are loading the content for a contextItem which is yet to be sent in a message
      if (messageId === undefined) {
        const currentItems = await this.#aiContextManager.getCurrentItems();
        await this.#view.setCurrentContextItems(
          currentItems.map(item => (item.id === contextItem.id ? hydratedContextItem : item)),
        );
        return;
      }

      // Otherwise we are hydrating a contextItem which is attached to an existing chat record.
      const messageIndex = this.chatHistory.findIndex(message => message.id === messageId);
      if (messageIndex === -1) {
        return;
      }

      const record = this.chatHistory.at(messageIndex);
      if (!record || !record.extras?.contextItems) {
        return;
      }

      record.extras.contextItems = record.extras.contextItems.map(item =>
        item.id === hydratedContextItem.id ? hydratedContextItem : item,
      );
      await this.#view.addRecord(record);
    } catch (error) {
      // FIXME: Show a UI warning if there's an error
      // https://gitlab.com/gitlab-org/gitlab/-/issues/489300
      log.error(`ContextItems: error getting context item content.`, error);
      await vscode.window.showErrorMessage('Error getting context item content');
    }
  }

  async getGitLabVersionForClear(manager: GitLabPlatformManagerForChat): Promise<string> {
    // If fetching the version fails, we return a version where /clean still works which was deprecated
    // in 17.5.0 for backwards compatibility.
    const DEPRECATED_CLEAN_VERSION = '17.4.0';

    try {
      const platform = await manager.getGitLabPlatform();
      if (!platform) {
        throw new Error('Could not get GitLabPlatform');
      }

      const { version } = await platform.fetchFromApi(versionRequest);
      return version;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error fetching version';
      log.error(`GitLab Platform: ${errorMessage}`, error);
      await vscode.window.showErrorMessage(`GitLab Platform: ${errorMessage}`);
      return DEPRECATED_CLEAN_VERSION;
    }
  }
}
