import * as vscode from 'vscode';
import type { AIContextCategory, AIContextItem } from '@gitlab-org/gitlab-lsp';
import { AiCompletionResponseMessageType } from '../api/graphql/ai_completion_response_channel';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { handleError } from '../errors/handle_error';
import { GitLabEnvironment } from '../snowplow/get_environment';
import { GitLabChatController } from './gitlab_chat_controller';
import { GitLabPlatformManagerForChat } from './get_platform_manager_for_chat';
import { GitLabChatRecord } from './gitlab_chat_record';
import { GitLabChatView } from './gitlab_chat_view';
import { SubmitFeedbackParams, submitFeedback } from './utils/submit_feedback';
import { SPECIAL_MESSAGES } from './constants';
import { AIContextManager } from './ai_context_manager';

jest.mock('../errors/handle_error');

const apiMock = {
  processNewUserPrompt: jest.fn(),
  pullAiMessage: jest.fn(),
  clearChat: jest.fn(),
  subscribeToUpdates: jest.fn(),
  getGitLabEnvironment: jest.fn(),
  cancelPrompt: jest.fn(),
};

jest.mock('./gitlab_chat_api', () => ({
  GitLabChatApi: jest.fn().mockImplementation(() => apiMock),
}));

jest.mock('./utils/submit_feedback', () => ({
  submitFeedback: jest.fn(),
}));

const viewMock = createFakePartial<GitLabChatView>({
  addRecord: jest.fn(),
  updateRecord: jest.fn(),
  show: jest.fn(),
  onViewMessage: jest.fn(),
  onDidBecomeVisible: jest.fn(),
  resolveWebviewView: jest.fn(),
  clearChat: jest.fn(),
  cancelPrompt: jest.fn(),
  setContextItemCategories: jest.fn(),
  setCurrentContextItems: jest.fn(),
  setContextItemSearchResults: jest.fn(),
  setChatFocused: jest.fn(),
});

jest.mock('./gitlab_chat_view', () => ({
  GitLabChatView: jest.fn().mockImplementation(() => viewMock),
}));

describe('GitLabChatController', () => {
  let controller: GitLabChatController;
  let aiContextManager: AIContextManager;

  beforeEach(() => {
    const platformManager = createFakePartial<GitLabPlatformManagerForChat>({
      getGitLabEnvironment: async () => GitLabEnvironment.GITLAB_COM,
    });

    aiContextManager = createFakePartial<AIContextManager>({
      // note, we reject as default to ensure backwards compatibility
      getAvailableCategories: jest.fn().mockRejectedValue(new Error('asd')),
    });

    controller = new GitLabChatController(
      platformManager,
      {} as vscode.ExtensionContext,
      aiContextManager,
    );
    apiMock.processNewUserPrompt = jest.fn().mockResolvedValue({
      aiAction: {
        errors: [],
        requestId: 'uniqueId',
      },
    });

    apiMock.pullAiMessage = jest.fn().mockImplementation((requestId: string, role: string) => ({
      content: `api response ${role}`,
      role,
      requestId,
      timestamp: '2023-01-01 01:01:01',
      extras: { sources: ['foo'] },
    }));

    viewMock.setErrorScreenContent = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveWebviewView', () => {
    const webview = {} as Partial<vscode.WebviewView> as vscode.WebviewView;

    it('delegates to view', async () => {
      await controller.resolveWebviewView(webview);

      expect(viewMock.resolveWebviewView).toHaveBeenCalledWith(webview);
    });

    it('calls aiContextManager methods to refresh context categories and current items', async () => {
      aiContextManager.getAvailableCategories = jest.fn().mockResolvedValue(['files', 'symbols']);
      aiContextManager.getCurrentItems = jest.fn().mockResolvedValue([]);
      viewMock.setContextItemCategories = jest.fn();
      viewMock.setCurrentContextItems = jest.fn();

      await controller.resolveWebviewView({} as vscode.WebviewView);

      expect(aiContextManager.getAvailableCategories).toHaveBeenCalled();
      expect(viewMock.setContextItemCategories).toHaveBeenCalledWith(['files', 'symbols']);
      expect(aiContextManager.getCurrentItems).toHaveBeenCalled();
      expect(viewMock.setCurrentContextItems).toHaveBeenCalledWith([]);
    });

    it('restores chat history', async () => {
      controller.chatHistory.push(
        new GitLabChatRecord({ role: 'user', content: 'ping' }),
        new GitLabChatRecord({ role: 'assistant', content: 'pong' }),
      );

      await controller.resolveWebviewView(webview);

      expect(viewMock.addRecord).toHaveBeenNthCalledWith(1, controller.chatHistory[0]);
      expect(viewMock.addRecord).toHaveBeenNthCalledWith(2, controller.chatHistory[1]);
    });

    it('shows error screen on error', async () => {
      const error = new Error('Test Error');
      viewMock.resolveWebviewView = jest.fn().mockImplementation(() => {
        throw new Error(error.message);
      });

      await controller.resolveWebviewView({} as vscode.WebviewView);

      expect(viewMock.setErrorScreenContent).toHaveBeenCalledWith(error);
    });
  });

  describe('processNewUserRecord', () => {
    let userRecord: GitLabChatRecord;
    let temporaryAssistantRecord: GitLabChatRecord;

    beforeEach(() => {
      userRecord = new GitLabChatRecord({ role: 'user', content: 'hello' });
      temporaryAssistantRecord = new GitLabChatRecord({
        role: 'assistant',
        state: 'pending',
        requestId: 'uniqueId',
      });
    });

    describe('before the api call', () => {
      beforeEach(() => {
        apiMock.processNewUserPrompt = jest.fn(() => {
          throw new Error('asd');
        });
      });

      it('shows the view', async () => {
        try {
          await controller.processNewUserRecord(userRecord);
        } catch (e) {
          /* empty */
        }

        expect(viewMock.show).toHaveBeenCalled();
      });
    });

    it('adds both the user prompt and the temporary assistant record', async () => {
      await controller.processNewUserRecord(userRecord);

      expect(viewMock.addRecord).toHaveBeenCalledTimes(2);
      expect(jest.mocked(viewMock.addRecord).mock.calls[0][0]).toEqual(userRecord);
      // check temporary assistant message
      expect(jest.mocked(viewMock.addRecord).mock.calls[1][0].requestId).toEqual(
        temporaryAssistantRecord.requestId,
      );
      expect(jest.mocked(viewMock.addRecord).mock.calls[1][0].role).toEqual(
        temporaryAssistantRecord.role,
      );
      expect(jest.mocked(viewMock.addRecord).mock.calls[1][0].state).toEqual(
        temporaryAssistantRecord.state,
      );
    });

    describe('with API error on sending the message', () => {
      it('updates message with API error and sends VSCode error notification', async () => {
        apiMock.processNewUserPrompt = jest
          .fn()
          .mockRejectedValue({ response: { errors: [{ message: 'testError' }] } });

        await controller.processNewUserRecord(userRecord);

        expect(userRecord.errors).toStrictEqual([
          'Failed to send the chat message to the API: testError',
        ]);
        expect(handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Failed to send the chat message to the API: testError',
          }),
        );
      });
    });

    it('fills updated history', async () => {
      expect(controller.chatHistory).toEqual([]);

      await controller.processNewUserRecord(userRecord);

      expect(controller.chatHistory[0]).toEqual(userRecord);

      expect(controller.chatHistory[1].role).toEqual(temporaryAssistantRecord.role);
      expect(controller.chatHistory[1].content).toEqual(temporaryAssistantRecord.content);
    });

    it('does not change userRecord timestamp when api returns an error', async () => {
      const timestampBefore = userRecord.timestamp;

      apiMock.pullAiMessage = jest.fn(() => ({
        type: 'error',
        errors: ['timeout'],
        requestId: 'requestId',
        role: 'system',
      }));

      await controller.processNewUserRecord(userRecord);

      expect(userRecord.timestamp).toStrictEqual(timestampBefore);
    });

    it('passes active file context to the API', async () => {
      const currentFileContext = {
        fileName: 'foo.rb',
        selectedText: 'selected_text',
        contentAboveCursor: 'before_text',
        contentBelowCursor: 'after_text',
      };

      userRecord.context = { currentFile: currentFileContext };

      await controller.processNewUserRecord(userRecord);

      expect(apiMock.processNewUserPrompt).toHaveBeenCalledWith(
        'hello',
        expect.any(String),
        currentFileContext,
        undefined,
      );
    });

    describe('with newChatConversation command', () => {
      beforeEach(() => {
        userRecord = new GitLabChatRecord({
          role: 'user',
          content: SPECIAL_MESSAGES.RESET,
          type: 'newConversation',
        });
      });

      it('sends only new user userRecord and doesnt wait for response', async () => {
        await controller.processNewUserRecord(userRecord);

        expect(viewMock.addRecord).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            content: SPECIAL_MESSAGES.RESET,
            state: 'ready',
            role: 'user',
          }),
        );
        expect(viewMock.addRecord).toHaveBeenCalledTimes(1);

        expect(controller.chatHistory[0]).toEqual(
          expect.objectContaining({
            content: SPECIAL_MESSAGES.RESET,
            state: 'ready',
            role: 'user',
            type: 'newConversation',
          }),
        );
        expect(controller.chatHistory.length).toEqual(1);
      });
    });

    describe('with clearChat command', () => {
      beforeEach(() => {
        userRecord = new GitLabChatRecord({
          role: 'user',
          content: SPECIAL_MESSAGES.CLEAR,
          type: 'clearChat',
        });

        apiMock.clearChat.mockResolvedValue({
          aiAction: {
            errors: [],
            requestId: 'uniqueId',
          },
        });
      });

      it('calls clearChatWindow and does not send another message', async () => {
        await controller.processNewUserRecord(userRecord);

        expect(apiMock.clearChat).toHaveBeenCalled();
        expect(viewMock.clearChat).toHaveBeenCalled();
      });
    });

    it('handles API errors and disconnects cable when action fails', async () => {
      const newUserRecord = new GitLabChatRecord({ role: 'user', content: 'hello' });
      const mockCable = { disconnect: jest.fn() };
      const mockError = new Error('API error');
      (mockError as unknown as { response: { errors: { message: string }[] } }).response = {
        errors: [{ message: 'Something went wrong' }],
      };

      apiMock.processNewUserPrompt = jest.fn().mockRejectedValue(mockError);
      apiMock.subscribeToUpdates = jest.fn().mockResolvedValue(mockCable);

      await controller.processNewUserRecord(newUserRecord);

      expect(mockCable.disconnect).toHaveBeenCalled();
      expect(newUserRecord.errors).toEqual([
        'Failed to send the chat message to the API: Something went wrong',
      ]);
      expect(handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to send the chat message to the API: Something went wrong',
        }),
      );
    });

    it('uses fallback polling when subscription fails', async () => {
      const newUserRecord = new GitLabChatRecord({ role: 'user', content: 'hello' });
      const subscriptionError = new Error('Subscription failed');

      apiMock.processNewUserPrompt = jest.fn().mockResolvedValue({
        aiAction: {
          errors: [],
          requestId: 'uniqueId',
        },
      });
      apiMock.subscribeToUpdates = jest.fn().mockRejectedValue(subscriptionError);

      await controller.processNewUserRecord(newUserRecord);

      expect(apiMock.pullAiMessage).toHaveBeenCalledTimes(2);
      expect(apiMock.pullAiMessage).toHaveBeenCalledWith('uniqueId', 'user');
      expect(apiMock.pullAiMessage).toHaveBeenCalledWith('uniqueId', 'assistant');
    });
  });

  describe('message updates subscription', () => {
    let userRecord: GitLabChatRecord;
    let chunk: Partial<AiCompletionResponseMessageType>;
    let subscriptionHandler = () => {};

    beforeEach(async () => {
      userRecord = new GitLabChatRecord({ role: 'user', content: 'hello' });
      chunk = {
        chunkId: 1,
        content: 'chunk #1',
        role: 'assistant',
        timestamp: 'foo',
        requestId: 'uniqueId',
        errors: [],
      };
      apiMock.subscribeToUpdates.mockImplementation(messageCallback => {
        subscriptionHandler = () => {
          messageCallback(chunk);
        };
      });
      await controller.processNewUserRecord(userRecord);
    });

    it('subscribes to the message updates', () => {
      expect(apiMock.subscribeToUpdates).toHaveBeenCalled();
    });

    it('updates the existing record', () => {
      chunk = {
        ...chunk,
        requestId: 'uniqueId',
      };

      expect(viewMock.addRecord).toHaveBeenCalledTimes(2);

      subscriptionHandler();

      expect(viewMock.addRecord).toHaveBeenCalledTimes(2);
      expect(viewMock.updateRecord).toHaveBeenCalledTimes(1);
      expect(jest.mocked(viewMock.updateRecord).mock.calls[0][0]).toEqual(
        expect.objectContaining({
          chunkId: 1,
          content: 'chunk #1',
          state: 'ready',
          requestId: 'uniqueId',
        }),
      );
    });

    it('does not update any record if the record does not exist yet', () => {
      chunk = {
        ...chunk,
        requestId: 'non-existingId',
      };

      subscriptionHandler();

      expect(viewMock.updateRecord).toHaveBeenCalledTimes(0);
    });

    it('updates the record with additional context items from the response', async () => {
      const newUserRecord = new GitLabChatRecord({ role: 'user', content: 'hello' });

      apiMock.processNewUserPrompt = jest.fn().mockResolvedValue({
        aiAction: {
          errors: [],
          requestId: 'uniqueId',
        },
      });

      apiMock.subscribeToUpdates = jest.fn(async messageCallback => {
        const data: AiCompletionResponseMessageType = {
          requestId: 'uniqueId',
          role: 'assistant',
          content: 'Response content',
          chunkId: 1,
          timestamp: 'foo',
          errors: [],
          extras: {
            sources: [],
            additionalContext: [
              createFakePartial<AIContextItem>({
                id: '1',
                category: 'file',
                content: 'file content',
                metadata: {},
              }),
            ],
          },
        };
        await messageCallback(data);
        return { cable: { disconnect: jest.fn() } };
      });

      await controller.processNewUserRecord(newUserRecord);
      await jest.runAllTimersAsync();

      expect(jest.mocked(viewMock.updateRecord).mock.calls[0][0]).toBeInstanceOf(GitLabChatRecord);
      expect(jest.mocked(viewMock.updateRecord).mock.calls[0][0].extras?.contextItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'file',
          }),
        ]),
      );
    });
  });

  describe('viewMessageHandler', () => {
    describe('insertCodeSnippet', () => {
      beforeEach(() => {
        vscode.window.activeTextEditor = createFakePartial<vscode.TextEditor>({
          insertSnippet: jest.fn(),
        });
      });
      it('calls insertCodeSnippet when data is present', async () => {
        const snippet = 'const example = "test";';
        await controller.viewMessageHandler({
          eventType: 'insertCodeSnippet',
          data: {
            snippet,
          },
        });

        expect(vscode.window.activeTextEditor?.insertSnippet).toHaveBeenCalledWith(
          new vscode.SnippetString(snippet),
        );
      });

      it('does not call insertCodeSnippet when no data is present', async () => {
        await controller.viewMessageHandler({
          eventType: 'insertCodeSnippet',
        });

        expect(vscode.window.activeTextEditor?.insertSnippet).not.toHaveBeenCalled();
      });

      it('shows warning message when there is no active editor', async () => {
        const snippet = 'const example = "test";';
        vscode.window.activeTextEditor = undefined;

        await controller.viewMessageHandler({
          eventType: 'insertCodeSnippet',
          data: {
            snippet,
          },
        });

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
          "There's no active editor to insert the snippet into.",
        );
      });
    });
    describe('trackFeedback', () => {
      it('calls submitFeedback when data is present', async () => {
        const expected: SubmitFeedbackParams = {
          didWhat: 'didWhat',
          improveWhat: 'improveWhat',
          feedbackChoices: ['choice1', 'choice2'],
          gitlabEnvironment: GitLabEnvironment.GITLAB_COM,
        };

        await controller.viewMessageHandler({
          eventType: 'trackFeedback',
          data: {
            didWhat: expected.didWhat,
            improveWhat: expected.improveWhat,
            feedbackChoices: expected.feedbackChoices,
          },
        });

        expect(submitFeedback).toHaveBeenCalledWith(expected);
      });

      it('does not call submitFeedback when no data is present', async () => {
        await controller.viewMessageHandler({
          eventType: 'trackFeedback',
        });

        expect(submitFeedback).not.toHaveBeenCalled();
      });
    });
    describe('newPrompt', () => {
      beforeEach(() => {
        const mockGetGitLabVersion = jest.fn().mockResolvedValue('17.5.0');
        controller.getGitLabVersionForClear = mockGetGitLabVersion;
      });

      it('processes new userRecord', async () => {
        controller.processNewUserRecord = jest.fn();

        await controller.viewMessageHandler({
          eventType: 'newPrompt',
          record: {
            content: 'hello',
          },
        });

        expect(controller.processNewUserRecord).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'hello',
          }),
        );
      });
      it('processes new user record and clears selected context items', async () => {
        const recordContent = 'hello';
        controller.processNewUserRecord = jest.fn();
        aiContextManager.clearSelectedContextItems = jest.fn();

        await controller.viewMessageHandler({
          eventType: 'newPrompt',
          record: { content: recordContent },
        });

        expect(controller.processNewUserRecord).toHaveBeenCalledWith(expect.any(GitLabChatRecord));
        expect(aiContextManager.clearSelectedContextItems).toHaveBeenCalled();
      });
    });

    describe('cancelPrompt', () => {
      const canceledPromptRequestIds = ['test-request-id-1', 'test-request-id-2'];
      beforeEach(() => {
        controller.processNewUserRecord = jest.fn();
      });

      it('should pass all cancelPrompt IDs to webview when cancelling', async () => {
        await controller.viewMessageHandler({
          eventType: 'cancelPrompt',
          canceledPromptRequestId: canceledPromptRequestIds[0],
        });

        expect(viewMock.cancelPrompt).toHaveBeenCalledWith([canceledPromptRequestIds[0]]);

        jest.mocked(viewMock.cancelPrompt).mockClear();

        await controller.viewMessageHandler({
          eventType: 'cancelPrompt',
          canceledPromptRequestId: canceledPromptRequestIds[1],
        });

        expect(viewMock.cancelPrompt).toHaveBeenCalledWith(canceledPromptRequestIds);
      });

      it('should send cancelPrompt IDs when refreshing webview', async () => {
        await controller.viewMessageHandler({
          eventType: 'cancelPrompt',
          canceledPromptRequestId: canceledPromptRequestIds[0],
        });

        await controller.resolveWebviewView(viewMock as unknown as vscode.WebviewView);

        expect(viewMock.cancelPrompt).toHaveBeenCalledWith([canceledPromptRequestIds[0]]);
      });
    });

    describe('contextItemRemoved', () => {
      it('calls aiContextManager.remove and refreshes current context items', async () => {
        const contextItem = createFakePartial<AIContextItem>({
          id: '1',
          category: 'file',
          content: 'content',
          metadata: {
            title: 'title',
            enabled: true,
            subType: 'open_tab',
          },
        });
        aiContextManager.remove = jest.fn().mockResolvedValue(true);
        aiContextManager.getCurrentItems = jest.fn().mockResolvedValue([]);
        viewMock.setCurrentContextItems = jest.fn();

        await controller.viewMessageHandler({
          eventType: 'contextItemRemoved',
          item: contextItem,
        });

        expect(aiContextManager.remove).toHaveBeenCalledWith(contextItem);
        expect(aiContextManager.getCurrentItems).toHaveBeenCalled();
        expect(viewMock.setCurrentContextItems).toHaveBeenCalledWith([]);
      });
    });
    describe('contextItemAdded', () => {
      it('calls aiContextManager.add and refreshes current context items', async () => {
        const contextItem = createFakePartial<AIContextItem>({
          id: '1',
          category: 'file',
          content: 'content',
          metadata: {
            title: 'title',
            enabled: true,
            subType: 'open_tab',
          },
        });
        aiContextManager.add = jest.fn().mockResolvedValue(true);
        aiContextManager.getCurrentItems = jest.fn().mockResolvedValue([contextItem]);
        viewMock.setCurrentContextItems = jest.fn();

        await controller.viewMessageHandler({
          eventType: 'contextItemAdded',
          item: contextItem,
        });

        expect(aiContextManager.add).toHaveBeenCalledWith(contextItem);
        expect(aiContextManager.getCurrentItems).toHaveBeenCalled();
        expect(viewMock.setCurrentContextItems).toHaveBeenCalledWith([contextItem]);
      });
    });
    describe('contextItemSearchQuery', () => {
      it('calls aiContextManager.query with correct parameters and updates view with results', async () => {
        const category = 'file' as AIContextCategory;
        const query = 'test query';
        const results: AIContextItem[] = [
          createFakePartial<AIContextItem>({
            id: '1',
            category,
            content: 'result',
            metadata: {
              title: 'title',
              enabled: true,
              subType: 'open_tab',
            },
          }),
        ];
        aiContextManager.query = jest.fn().mockResolvedValue(results);
        vscode.window.showWarningMessage = jest.fn();
        viewMock.setContextItemSearchResults = jest.fn();

        await controller.viewMessageHandler({
          eventType: 'contextItemSearchQuery',
          query: { category, query },
        });

        expect(aiContextManager.query).toHaveBeenCalledWith({
          workspaceFolders: expect.any(Array),
          query,
          category,
        });
        expect(viewMock.setContextItemSearchResults).toHaveBeenCalledWith(results);
      });
    });
    describe('contextItemGetContent', () => {
      let contextItem: AIContextItem;
      let hydratedContextItem: AIContextItem;
      beforeEach(() => {
        aiContextManager.getCurrentItems = jest.fn().mockResolvedValue([contextItem]);
        aiContextManager.getItemWithContent = jest.fn().mockResolvedValue(hydratedContextItem);
        vscode.window.showWarningMessage = jest.fn();
        viewMock.setCurrentContextItems = jest.fn();

        contextItem = createFakePartial<AIContextItem>({
          id: '1',
          category: 'file',
          content: undefined,
          metadata: {
            title: 'title',
            enabled: true,
            subType: 'open_tab',
          },
        });
        hydratedContextItem = {
          ...contextItem,
          content: 'water',
        };
      });

      it('calls aiContextManager.getContent with correct parameters', async () => {
        await controller.viewMessageHandler({
          eventType: 'contextItemGetContent',
          item: contextItem,
          messageId: undefined,
        });

        expect(aiContextManager.getItemWithContent).toHaveBeenCalledWith(contextItem);
      });

      describe('when there is no messageId', () => {
        it('updates selected context items in the view with the hydrated context item', async () => {
          await controller.viewMessageHandler({
            eventType: 'contextItemGetContent',
            item: contextItem,
            messageId: undefined,
          });

          expect(viewMock.setCurrentContextItems).toHaveBeenCalledWith([hydratedContextItem]);
        });
      });

      describe('when there is a messageId', () => {
        it('updates expected chat record in the view with the hydrated context item', async () => {
          const userRecord = new GitLabChatRecord({
            role: 'user',
            content: 'ping',
            extras: {
              sources: [],
              contextItems: [contextItem],
            },
          });
          controller.chatHistory.push(
            userRecord,
            new GitLabChatRecord({ role: 'assistant', content: 'pong' }),
          );

          await controller.viewMessageHandler({
            eventType: 'contextItemGetContent',
            item: contextItem,
            messageId: userRecord.id,
          });

          expect(viewMock.addRecord).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
              id: userRecord.id,
              extras: expect.objectContaining({
                contextItems: [hydratedContextItem],
              }),
            }),
          );
        });
      });
    });
    describe('isChatFocused', () => {
      it('should call setChatFocused', async () => {
        const isChatFocused = true;
        await controller.viewMessageHandler({
          eventType: 'isChatFocused',
          isChatFocused,
        });

        expect(viewMock.setChatFocused).toHaveBeenCalledWith(isChatFocused);
      });
    });
  });
});
