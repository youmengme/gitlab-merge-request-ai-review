import assert from 'assert';
import { Cable } from '@anycable/core';
import { AIContextItemMetadata } from '@gitlab-org/gitlab-lsp';
import { createFakeCable, gitlabPlatformForAccount } from '../test_utils/entities';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { GitLabVersionResponse } from '../gitlab/check_version';
import { AiCompletionResponseChannel } from '../api/graphql/ai_completion_response_channel';
import { currentUserRequest } from '../gitlab/api/get_current_user';
import { GitLabPlatformManagerForChat } from './get_platform_manager_for_chat';

import {
  GitLabChatApi,
  AI_MESSAGES_QUERY,
  CHAT_INPUT_TEMPLATE_17_2_AND_EARLIER,
  CHAT_INPUT_TEMPLATE_17_3_AND_LATER,
  CHAT_INPUT_TEMPLATE_17_5_AND_LATER,
  CHAT_INPUT_TEMPLATE_17_10_AND_LATER,
  ConversationType,
  GitLabGID,
} from './gitlab_chat_api';
import { API_PULLING } from './api/pulling';
import { SPECIAL_MESSAGES, PLATFORM_ORIGIN } from './constants';
import { AIContextManager } from './ai_context_manager';

API_PULLING.interval = 1; // wait only 1ms between pulling attempts.

const mockedMutationResponse = {
  aiAction: { requestId: '123', errors: [] as string[] },
};

const mockedQueryResponse = {
  aiMessages: {
    nodes: [
      {
        content: 'test',
        requestId: '123',
        role: 'assistant',
        errors: ['bar'],
        timestamp: '2023-01-01 01:01:01',
        extras: {
          sources: ['foo'],
        },
      },
    ],
  },
};

const mockedEmptyQueryResponse = {
  aiMessages: { nodes: [] },
};

const mockPrompt = 'What is a fork?';
const mockGetProjectGqlId = jest.fn(
  async (): Promise<string | undefined> => 'gid://gitlab/Project/123',
);

jest.mock('../api/graphql/ai_completion_response_channel', () => {
  const {
    AiCompletionResponseChannel: AiCompletionResponseChannelOriginal,
    AiCompletionResponseMessageType,
  } = jest.requireActual('../api/graphql/ai_completion_response_channel');

  return {
    AiCompletionResponseMessageType,
    AiCompletionResponseChannel: jest
      .fn()
      .mockImplementation((...args) => new AiCompletionResponseChannelOriginal(...args)),
  };
});

describe('GitLabChatApi', () => {
  let makeApiRequest: jest.Mock;
  let manager: GitLabPlatformManagerForChat;
  let cable: Cable;
  let gitlabChatApi: GitLabChatApi;
  let versionResponse: () => Promise<GitLabVersionResponse>;
  let canceledPromptRequestIds: string[];
  let aiContextManager: AIContextManager;

  const createManager = (
    queryContent = mockedQueryResponse,
    mutationContent = mockedMutationResponse,
  ): GitLabPlatformManagerForChat => {
    makeApiRequest = jest.fn(async <T>(params: { path?: string; query?: string }): Promise<T> => {
      let response;
      if (params.path === '/version') {
        response = (await versionResponse()) as T;
      } else if (
        params?.query === CHAT_INPUT_TEMPLATE_17_2_AND_EARLIER.query ||
        params?.query === CHAT_INPUT_TEMPLATE_17_3_AND_LATER.query ||
        params?.query === CHAT_INPUT_TEMPLATE_17_5_AND_LATER.query ||
        params?.query === CHAT_INPUT_TEMPLATE_17_10_AND_LATER.query
      ) {
        response = mutationContent as T;
      } else {
        response = queryContent as T;
      }
      return response;
    });

    return createFakePartial<GitLabPlatformManagerForChat>({
      getProjectGqlId: mockGetProjectGqlId,
      getGitLabPlatform: jest.fn(async () => ({
        ...gitlabPlatformForAccount,
        connectToCable: async () => cable,
        fetchFromApi: makeApiRequest,
      })),
    });
  };

  beforeEach(async () => {
    cable = createFakeCable();
    manager = createManager(mockedQueryResponse);
    canceledPromptRequestIds = [];
    aiContextManager = createFakePartial<AIContextManager>({
      isAdditionalContextEnabled: jest.fn(async () => false),
    });
    gitlabChatApi = new GitLabChatApi(manager, canceledPromptRequestIds, aiContextManager);
    versionResponse = () =>
      Promise.resolve({
        version: '17.3.0',
        enterprise: true,
      });
  });

  describe('getAiMessage', () => {
    it('returns first message with given requestId and role', async () => {
      const expectedMessage = mockedQueryResponse.aiMessages.nodes[0];

      const response = await gitlabChatApi.pullAiMessage(
        expectedMessage.requestId,
        expectedMessage.role,
      );

      assert(response.type === 'message');

      const [, [aiMessagesQuery]] = makeApiRequest.mock.calls;

      expect(aiMessagesQuery.query).toBe(AI_MESSAGES_QUERY);
      expect(response.content).toBe(expectedMessage.content);
      expect(response.requestId).toBe(expectedMessage.requestId);
      expect(response.errors).toStrictEqual(expectedMessage.errors);
      expect(response.timestamp).toStrictEqual(expectedMessage.timestamp);
      expect(response.extras).toStrictEqual(expectedMessage.extras);
    });

    it('returns an error if pulling timeout is reached', async () => {
      manager = createManager(mockedEmptyQueryResponse);
      gitlabChatApi = new GitLabChatApi(manager, [], aiContextManager);

      const response = await gitlabChatApi.pullAiMessage('123', 'assistant');

      expect(response.requestId).toBe('123');
      expect(response.errors).toContainEqual('Reached timeout while fetching response.');
    });
  });

  describe('subscribeToUpdates', () => {
    const createChunkMessage = (chunkId: string) => ({
      result: { data: { aiCompletionResponse: { role: 'assistant', chunkId } } },
    });
    const createFullMessage = () => ({
      result: { data: { aiCompletionResponse: { role: 'assistant' } } }, // no chunkId means a full message
    });
    const userId = '123';
    let callback: jest.Mock;

    beforeEach(async () => {
      makeApiRequest.mockImplementationOnce(() => ({ id: userId }));
      callback = jest.fn();
      await gitlabChatApi.subscribeToUpdates(callback, 'xyz');
    });

    it('stops processing messages once fullMessage is received', async () => {
      const channel = jest.mocked(cable.subscribe).mock.calls[0][0];
      channel.receive(createChunkMessage('1'));
      channel.receive(createFullMessage());
      channel.receive(createChunkMessage('2')); // this one gets ignored

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('provides current user id to the ai completion channel', () => {
      expect(makeApiRequest).toHaveBeenCalledTimes(1);
      expect(makeApiRequest).toHaveBeenCalledWith(currentUserRequest);
      expect(AiCompletionResponseChannel).toHaveBeenCalledWith(
        {
          aiAction: 'CHAT',
          clientSubscriptionId: 'xyz',
          htmlResponse: false,
          userId: `gid://gitlab/User/${userId}`,
        },
        false,
      );
    });
  });

  describe('processNewUserPrompt', () => {
    it('sends user prompt as mutation', async () => {
      const response = await gitlabChatApi.processNewUserPrompt(mockPrompt);

      expect(response.aiAction).toBe(mockedMutationResponse.aiAction);

      const [, [aiActionMutation]] = makeApiRequest.mock.calls;

      expect(aiActionMutation.query).toBe(CHAT_INPUT_TEMPLATE_17_3_AND_LATER.query);
      expect(aiActionMutation.variables.currentFileContext).toStrictEqual(undefined);
      expect(aiActionMutation.variables.resourceId).toBe('gid://gitlab/Project/123');
      expect(aiActionMutation.variables.platformOrigin).toBe(PLATFORM_ORIGIN);
    });

    it('omits the platform origin field for chat mutation for GitLab 17.2 and earlier', async () => {
      versionResponse = () =>
        Promise.resolve({
          version: '17.2.0',
          enterprise: true,
        });
      const response = await gitlabChatApi.processNewUserPrompt(mockPrompt);

      expect(response.aiAction).toBe(mockedMutationResponse.aiAction);

      const [, [aiActionMutation]] = makeApiRequest.mock.calls;

      expect(aiActionMutation.query).toBe(CHAT_INPUT_TEMPLATE_17_2_AND_EARLIER.query);
      expect(aiActionMutation.variables.currentFileContext).toStrictEqual(undefined);
      expect(aiActionMutation.variables.resourceId).toBe('gid://gitlab/Project/123');
      expect(aiActionMutation.variables.platformOrigin).toBe(undefined);
    });

    it('sends the platform origin field for chat mutation for GitLab 17.3 and later', async () => {
      const response = await gitlabChatApi.processNewUserPrompt(mockPrompt);

      expect(response.aiAction).toBe(mockedMutationResponse.aiAction);

      const [, [aiActionMutation]] = makeApiRequest.mock.calls;

      expect(aiActionMutation.query).toBe(CHAT_INPUT_TEMPLATE_17_3_AND_LATER.query);
      expect(aiActionMutation.variables.currentFileContext).toStrictEqual(undefined);
      expect(aiActionMutation.variables.resourceId).toBe('gid://gitlab/Project/123');
      expect(aiActionMutation.variables.platformOrigin).toBe(PLATFORM_ORIGIN);

      // Make an additional call to verify we don't duplicate the version request.
      await gitlabChatApi.processNewUserPrompt(mockPrompt);
      expect(makeApiRequest).toHaveBeenCalledTimes(3);
    });

    it('sends the platform origin field for chat mutation when version query fails', async () => {
      versionResponse = () => Promise.reject();

      const response = await gitlabChatApi.processNewUserPrompt(mockPrompt);

      expect(response.aiAction).toBe(mockedMutationResponse.aiAction);

      const [, [aiActionMutation]] = makeApiRequest.mock.calls;

      expect(aiActionMutation.query).toBe(CHAT_INPUT_TEMPLATE_17_3_AND_LATER.query);
      expect(aiActionMutation.variables.currentFileContext).toStrictEqual(undefined);
      expect(aiActionMutation.variables.resourceId).toBe('gid://gitlab/Project/123');
      expect(aiActionMutation.variables.platformOrigin).toBe(PLATFORM_ORIGIN);
    });

    it('uses 17.10 template and sends conversationType and threadId when GitLab version is 17.10+', async () => {
      const threadId = 'gid://gitlab/FooThread/123';

      versionResponse = () =>
        Promise.resolve({
          version: '17.10.0',
          enterprise: true,
        });

      const response = await gitlabChatApi.processNewUserPrompt(
        mockPrompt,
        'subId',
        undefined,
        undefined,
        ConversationType.DUO_QUICK_CHAT,
        threadId,
      );

      expect(response.aiAction).toBe(mockedMutationResponse.aiAction);

      const [, [aiActionMutation]] = makeApiRequest.mock.calls;

      expect(aiActionMutation.query).toBe(CHAT_INPUT_TEMPLATE_17_10_AND_LATER.query);
      expect(aiActionMutation.variables.conversationType).toBe(ConversationType.DUO_QUICK_CHAT);
      expect(aiActionMutation.variables.threadId).toBe(threadId);
      expect(aiActionMutation.variables.platformOrigin).toBe(PLATFORM_ORIGIN);
    });

    it('sets resourceId to null when project is not available', async () => {
      mockGetProjectGqlId.mockResolvedValueOnce(undefined);

      await gitlabChatApi.processNewUserPrompt(mockPrompt);

      const [, [aiActionMutation]] = makeApiRequest.mock.calls;

      expect(aiActionMutation.variables.resourceId).toBe(null);
      expect(aiActionMutation.variables.platformOrigin).toBe(PLATFORM_ORIGIN);
    });

    it('when active file context is provided it also sends it with the prompt', async () => {
      const fileContext = {
        fileName: 'foo.rb',
        selectedText: 'selected_text',
        contentAboveCursor: 'before_text',
        contentBelowCursor: 'after_text',
      };

      const response = await gitlabChatApi.processNewUserPrompt(mockPrompt, undefined, fileContext);

      expect(response.aiAction).toBe(mockedMutationResponse.aiAction);

      const [, [aiActionMutation]] = makeApiRequest.mock.calls;

      expect(aiActionMutation.query).toBe(CHAT_INPUT_TEMPLATE_17_3_AND_LATER.query);
      expect(aiActionMutation.variables.currentFileContext).toStrictEqual(fileContext);
      expect(aiActionMutation.variables.resourceId).toBe('gid://gitlab/Project/123');
      expect(aiActionMutation.variables.platformOrigin).toBe(PLATFORM_ORIGIN);
    });
  });

  describe('special messages', () => {
    describe.each([
      {
        message: SPECIAL_MESSAGES.CLEAR,
        sendMessage: (threadId?: GitLabGID) => gitlabChatApi.clearChat(threadId),
      },
      {
        message: SPECIAL_MESSAGES.RESET,
        sendMessage: (threadId?: GitLabGID) => gitlabChatApi.resetChat(threadId),
      },
    ])('$message', ({ message, sendMessage }) => {
      it('sends the correct variables to chat mutation', async () => {
        await sendMessage();

        expect(makeApiRequest).toHaveBeenCalledWith({
          query: CHAT_INPUT_TEMPLATE_17_3_AND_LATER.query,
          type: 'graphql',
          variables: {
            currentFileContext: undefined,
            question: message,
            resourceId: 'gid://gitlab/Project/123',
            platformOrigin: PLATFORM_ORIGIN,
          },
        });
      });

      it('omits the platform origin field for GitLab 17.2 and earlier', async () => {
        versionResponse = () =>
          Promise.resolve({
            version: '17.2.0',
            enterprise: true,
          });

        await sendMessage();
        expect(makeApiRequest).toHaveBeenCalledWith({
          query: CHAT_INPUT_TEMPLATE_17_2_AND_EARLIER.query,
          type: 'graphql',
          variables: {
            currentFileContext: undefined,
            question: message,
            resourceId: 'gid://gitlab/Project/123',
          },
        });
      });

      it('sends the platform origin for GitLab 17.3 and later', async () => {
        await sendMessage();

        expect(makeApiRequest).toHaveBeenCalledWith({
          query: CHAT_INPUT_TEMPLATE_17_3_AND_LATER.query,
          type: 'graphql',
          variables: {
            currentFileContext: undefined,
            question: message,
            resourceId: 'gid://gitlab/Project/123',
            platformOrigin: PLATFORM_ORIGIN,
          },
        });

        // Make an additional call to verify we don't duplicate the version request.
        await sendMessage();

        expect(makeApiRequest).toHaveBeenCalledTimes(3);
      });

      it('sends threadId for GitLab 17.10 and later', async () => {
        const threadId = 'gid://gitlab/FooThread/123';

        versionResponse = () =>
          Promise.resolve({
            version: '17.10.0',
            enterprise: true,
          });

        await sendMessage(threadId);

        expect(makeApiRequest).toHaveBeenCalledWith({
          query: CHAT_INPUT_TEMPLATE_17_10_AND_LATER.query,
          type: 'graphql',
          variables: expect.objectContaining({
            threadId,
          }),
        });
      });

      it('sends the platform origin when version check fails', async () => {
        versionResponse = () => Promise.reject();

        await sendMessage();

        expect(makeApiRequest).toHaveBeenCalledWith({
          query: CHAT_INPUT_TEMPLATE_17_3_AND_LATER.query,
          type: 'graphql',
          variables: {
            currentFileContext: undefined,
            question: message,
            resourceId: 'gid://gitlab/Project/123',
            platformOrigin: PLATFORM_ORIGIN,
          },
        });
      });
    });

    describe('/clear', () => {
      it('clears the chat with the /clean command in GitLab 17.5 and earlier', async () => {
        versionResponse = () =>
          Promise.resolve({
            version: '17.4.0',
            enterprise: true,
          });

        await gitlabChatApi.clearChat();

        const [, [aiActionMutation]] = makeApiRequest.mock.calls;

        expect(aiActionMutation.query).toBe(CHAT_INPUT_TEMPLATE_17_3_AND_LATER.query);
        expect(aiActionMutation.variables).toEqual({
          currentFileContext: undefined,
          question: SPECIAL_MESSAGES.CLEAR,
          resourceId: 'gid://gitlab/Project/123',
          platformOrigin: PLATFORM_ORIGIN,
        });
      });
    });
  });

  describe('cancelChat', () => {
    const createChunkMessage = (chunkId: string, requestId: string) => ({
      result: { data: { aiCompletionResponse: { role: 'assistant', chunkId, requestId } } },
    });

    it('does not collect any more chunks from graphql', async () => {
      const requestId = 'uniqueId';
      const callback = jest.fn();
      await gitlabChatApi.subscribeToUpdates(callback, 'xyz');
      const channel = jest.mocked(cable.subscribe).mock.calls[0][0];
      channel.receive(createChunkMessage('1', requestId));

      canceledPromptRequestIds.push(requestId);

      channel.receive(createChunkMessage('2', requestId)); // this one gets ignored

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('processNewUserPrompt with additional context', () => {
    it('sends the additionalContext when provided and additionalContext is enabled', async () => {
      jest.mocked(aiContextManager.isAdditionalContextEnabled).mockResolvedValue(true);
      const aiContextItems = [
        {
          id: '1',
          category: 'file' as const,
          content: 'file content',
          metadata: {} as AIContextItemMetadata,
        },
        {
          id: '2',
          category: 'snippet' as const,
          content: 'snippet content',
          metadata: { language: 'javascript' } as unknown as AIContextItemMetadata,
        },
      ];

      const response = await gitlabChatApi.processNewUserPrompt(
        mockPrompt,
        undefined,
        undefined,
        aiContextItems,
      );

      expect(response.aiAction).toBe(mockedMutationResponse.aiAction);

      const [, [aiActionMutation]] = makeApiRequest.mock.calls;

      expect(aiActionMutation.variables.additionalContext).toEqual([
        {
          id: '1',
          category: 'FILE',
          content: 'file content',
          metadata: {},
        },
        {
          id: '2',
          category: 'SNIPPET',
          content: 'snippet content',
          metadata: { language: 'javascript' },
        },
      ]);

      expect(aiActionMutation.query).toBe(CHAT_INPUT_TEMPLATE_17_5_AND_LATER.query);
    });

    it('does not send additionalContext when not provided', async () => {
      const response = await gitlabChatApi.processNewUserPrompt(mockPrompt);

      expect(response.aiAction).toBe(mockedMutationResponse.aiAction);

      const [, [aiActionMutation]] = makeApiRequest.mock.calls;

      expect(aiActionMutation.variables.additionalContext).toBeUndefined();
      expect(aiActionMutation.query).toBe(CHAT_INPUT_TEMPLATE_17_3_AND_LATER.query);
    });

    it('uses the correct query template when additionalContext is provided', async () => {
      jest.mocked(aiContextManager.isAdditionalContextEnabled).mockResolvedValue(true);
      const aiContextItems = [
        {
          id: '1',
          category: 'file' as const,
          content: 'file content',
          metadata: {} as AIContextItemMetadata,
        },
      ];

      await gitlabChatApi.processNewUserPrompt(mockPrompt, undefined, undefined, aiContextItems);

      const [, [aiActionMutation]] = makeApiRequest.mock.calls;

      expect(aiActionMutation.query).toBe(CHAT_INPUT_TEMPLATE_17_5_AND_LATER.query);
      expect(aiActionMutation.variables.platformOrigin).toBe(PLATFORM_ORIGIN);
    });
  });
});
