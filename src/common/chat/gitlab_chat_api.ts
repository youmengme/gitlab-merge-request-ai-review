import { gql } from 'graphql-request';
import type { AIContextItem, AIContextCategory } from '@gitlab-org/gitlab-lsp';
import { Cable } from '@anycable/core';
import { GraphQLRequest } from '../platform/web_ide';
import {
  AiCompletionResponseChannel,
  AiCompletionResponseMessageType,
} from '../api/graphql/ai_completion_response_channel';
import { log } from '../log';
import { versionRequest } from '../gitlab/check_version';
import { ifVersionGte } from '../utils/if_version_gte';
import { currentUserRequest } from '../gitlab/api/get_current_user';
import { GitLabPlatformManagerForChat } from './get_platform_manager_for_chat';
import { GitLabChatFileContext } from './gitlab_chat_file_context';
import { pullHandler } from './api/pulling';
import { PLATFORM_ORIGIN, SPECIAL_MESSAGES } from './constants';
import { AIContextManager } from './ai_context_manager';

export const MINIMUM_PLATFORM_ORIGIN_FIELD_VERSION = '17.3.0';
export const MINIMUM_ADDITIONAL_CONTEXT_FIELD_VERSION = '17.5.0-pre';
export const MINIMUM_CONVERSATION_TYPE_VERSION = '17.10.0-pre';

// https://docs.gitlab.com/api/graphql/reference/#aiconversationsthreadsconversationtype
// threadId is required to retrieve messages for DUO_QUICK_CHAT and DUO_CHAT conversation types
export enum ConversationType {
  DUO_CHAT_LEGACY = 'DUO_CHAT_LEGACY', // default
  DUO_CHAT = 'DUO_CHAT',
  DUO_QUICK_CHAT = 'DUO_QUICK_CHAT',
}

export type ConversationTypeType = keyof typeof ConversationType;

// FIXME: Import from GitLab Language Server once type is added there
// https://gitlab.com/gitlab-org/editor-extensions/gitlab-lsp/-/issues/652
export type GitLabGID = `gid://gitlab/${string}/${string | number}`;

export const CHAT_INPUT_TEMPLATE_17_2_AND_EARLIER = {
  query: gql`
    mutation chat(
      $question: String!
      $resourceId: AiModelID
      $currentFileContext: AiCurrentFileInput
      $clientSubscriptionId: String
    ) {
      aiAction(
        input: {
          chat: { resourceId: $resourceId, content: $question, currentFile: $currentFileContext }
          clientSubscriptionId: $clientSubscriptionId
        }
      ) {
        requestId
        errors
      }
    }
  `,
  defaultVariables: {},
};

export const CHAT_INPUT_TEMPLATE_17_3_AND_LATER = {
  query: gql`
    mutation chat(
      $question: String!
      $resourceId: AiModelID
      $currentFileContext: AiCurrentFileInput
      $clientSubscriptionId: String
      $platformOrigin: String!
    ) {
      aiAction(
        input: {
          chat: { resourceId: $resourceId, content: $question, currentFile: $currentFileContext }
          clientSubscriptionId: $clientSubscriptionId
          platformOrigin: $platformOrigin
        }
      ) {
        requestId
        errors
      }
    }
  `,
  defaultVariables: {
    platformOrigin: PLATFORM_ORIGIN,
  },
};

export const CHAT_INPUT_TEMPLATE_17_5_AND_LATER = {
  query: gql`
    mutation chat(
      $question: String!
      $resourceId: AiModelID
      $currentFileContext: AiCurrentFileInput
      $clientSubscriptionId: String
      $platformOrigin: String!
      $additionalContext: [AiAdditionalContextInput!]
    ) {
      aiAction(
        input: {
          chat: {
            resourceId: $resourceId
            content: $question
            currentFile: $currentFileContext
            additionalContext: $additionalContext
          }
          clientSubscriptionId: $clientSubscriptionId
          platformOrigin: $platformOrigin
        }
      ) {
        requestId
        errors
      }
    }
  `,
  defaultVariables: {
    platformOrigin: PLATFORM_ORIGIN,
  },
};

export const CHAT_INPUT_TEMPLATE_17_10_AND_LATER = {
  query: gql`
    mutation chat(
      $question: String!
      $resourceId: AiModelID
      $currentFileContext: AiCurrentFileInput
      $clientSubscriptionId: String
      $platformOrigin: String!
      $additionalContext: [AiAdditionalContextInput!]
      $conversationType: AiConversationsThreadsConversationType
      $threadId: AiConversationThreadID
    ) {
      aiAction(
        input: {
          chat: {
            resourceId: $resourceId
            content: $question
            currentFile: $currentFileContext
            additionalContext: $additionalContext
          }
          clientSubscriptionId: $clientSubscriptionId
          platformOrigin: $platformOrigin
          conversationType: $conversationType
          threadId: $threadId
        }
      ) {
        requestId
        errors
        threadId
      }
    }
  `,
  defaultVariables: {
    platformOrigin: PLATFORM_ORIGIN,
  },
};

export type AiActionResponseType = {
  aiAction: { requestId: string; errors: string[]; threadId?: GitLabGID };
};

export const AI_MESSAGES_QUERY = gql`
  query getAiMessages($requestIds: [ID!], $roles: [AiMessageRole!]) {
    aiMessages(requestIds: $requestIds, roles: $roles) {
      nodes {
        requestId
        role
        content
        contentHtml
        timestamp
        errors
        extras {
          sources
        }
      }
    }
  }
`;

// TODO: update this query to include additional context
// https://gitlab.com/gitlab-org/gitlab/-/issues/489304
export const AI_MESSAGES_QUERY_17_5_AND_LATER = gql`
  query getAiMessages($requestIds: [ID!], $roles: [AiMessageRole!]) {
    aiMessages(requestIds: $requestIds, roles: $roles) {
      nodes {
        requestId
        role
        content
        contentHtml
        timestamp
        errors
        extras {
          sources
          additionalContext {
            id
            category
            metadata
          }
        }
      }
    }
  }
`;

type AiMessageResponseType = {
  requestId: string;
  role: string;
  content: string;
  timestamp: string;
  errors: string[];
  extras?: {
    sources: object[];
  };
  additionalContext?: AIContextItem[];
};

export type AiContextItemRequestType = Omit<AIContextItem, 'category'> & {
  // GraphQL expects uppercase category, e.g. 'FILE' and 'SNIPPET', internally we use lowercase 'file' and 'snippet'
  category: Uppercase<AIContextCategory>;
};

type AiMessagesResponseType = {
  aiMessages: {
    nodes: AiMessageResponseType[];
  };
};

interface ErrorMessage {
  type: 'error';
  requestId: string;
  role: 'system';
  errors: string[];
}

const errorResponse = (requestId: string, errors: string[]): ErrorMessage => ({
  requestId,
  errors,
  role: 'system',
  type: 'error',
});

interface SuccessMessage {
  type: 'message';
  requestId: string;
  role: string;
  content: string;
  timestamp: string;
  errors: string[];
  extras?: {
    sources: object[];
    additionalContext?: AIContextItem[];
  };
}

const successResponse = (response: AiMessageResponseType): SuccessMessage => ({
  type: 'message',
  ...response,
});

type AiMessage = SuccessMessage | ErrorMessage;

type ChatInputTemplate = {
  query: string;
  defaultVariables: {
    platformOrigin?: string;
  };
};

export class GitLabChatApi {
  #cachedActionMutation?: ChatInputTemplate = undefined;

  #cachedMessagesQuery?: string = undefined;

  #canceledPromptRequestIds: string[];

  #manager: GitLabPlatformManagerForChat;

  #aiContextManager: AIContextManager;

  constructor(
    manager: GitLabPlatformManagerForChat,
    canceledPromptRequestIds: string[],
    aiContextManager: AIContextManager,
  ) {
    this.#manager = manager;
    this.#canceledPromptRequestIds = canceledPromptRequestIds;
    this.#aiContextManager = aiContextManager;
  }

  async processNewUserPrompt(
    question: string,
    subscriptionId?: string,
    currentFileContext?: GitLabChatFileContext,
    aiContextItems?: AIContextItem[],
    conversationType?: ConversationTypeType,
    threadId?: GitLabGID,
  ): Promise<AiActionResponseType> {
    return this.#sendAiAction({
      question,
      currentFileContext,
      additionalContext: aiContextItems?.map(item => ({
        id: item.id,
        // GraphQL expects uppercase category, e.g. 'FILE' and 'SNIPPET', internally we use lowercase 'file' and 'snippet'
        category: item.category.toUpperCase() as Uppercase<AIContextCategory>,
        // we can safely assume that the content will be populated, by this point
        content: item.content ?? '',
        metadata: item.metadata,
      })),
      clientSubscriptionId: subscriptionId,
      threadId,
      conversationType,
    });
  }

  async pullAiMessage(requestId: string, role: string): Promise<AiMessage> {
    const response = await pullHandler(() => this.#getAiMessage(requestId, role));

    if (!response) return errorResponse(requestId, ['Reached timeout while fetching response.']);

    return successResponse(response);
  }

  async clearChat(threadId?: GitLabGID): Promise<AiActionResponseType> {
    return this.#sendAiAction({ question: SPECIAL_MESSAGES.CLEAR, threadId });
  }

  async resetChat(threadId?: GitLabGID): Promise<AiActionResponseType> {
    return this.#sendAiAction({ question: SPECIAL_MESSAGES.RESET, threadId });
  }

  async #currentPlatform() {
    const platform = await this.#manager.getGitLabPlatform();
    if (!platform) throw new Error('Platform is missing!');

    return platform;
  }

  async #getAiMessage(requestId: string, role: string): Promise<AiMessageResponseType | undefined> {
    const platform = await this.#currentPlatform();

    const query = await this.#messagesQuery();
    const request: GraphQLRequest<AiMessagesResponseType> = {
      type: 'graphql',
      query,
      variables: { requestIds: [requestId], roles: [role.toUpperCase()] },
    };

    const history = await platform.fetchFromApi(request);

    return history.aiMessages.nodes[0];
  }

  async subscribeToUpdates(
    messageCallback: (message: AiCompletionResponseMessageType) => Promise<void>,
    subscriptionId?: string,
  ): Promise<Cable> {
    const [platform, additionalContextEnabled] = await Promise.all([
      this.#currentPlatform(),
      this.#aiContextManager.isAdditionalContextEnabled(),
    ]);
    const currentUser = await platform.fetchFromApi(currentUserRequest);

    log.debug(
      `GitLabChatApi: subscribeToUpdates, additionalContextEnabled: ${additionalContextEnabled}`,
    );

    const channel = new AiCompletionResponseChannel(
      {
        htmlResponse: false,
        userId: `gid://gitlab/User/${currentUser.id}`,
        aiAction: 'CHAT',
        clientSubscriptionId: subscriptionId,
      },
      additionalContextEnabled,
    );

    const cable = await platform.connectToCable();

    // we use this flag to fix https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/1397
    // sometimes a chunk comes after the full message and it broke the chat
    let fullMessageReceived = false;

    channel.on('newChunk', async msg => {
      if (fullMessageReceived) {
        log.info(`CHAT-DEBUG: full message received, ignoring chunk`);
        return;
      }
      if (this.#canceledPromptRequestIds.includes(msg.requestId)) {
        log.info(`CHAT-DEBUG: stream cancelled, ignoring chunk`);
        return;
      }
      await messageCallback(msg);
    });
    channel.on('fullMessage', async message => {
      fullMessageReceived = true;

      if (this.#canceledPromptRequestIds.includes(message.requestId)) {
        log.info(`CHAT-DEBUG: stream cancelled, ignoring full message`);
        cable.disconnect();
        return;
      }

      await messageCallback(message);

      if (subscriptionId) {
        cable.disconnect();
      }
    });

    cable.subscribe(channel);
    return cable;
  }

  async #sendAiAction(variables: {
    question: string;
    subscriptionId?: string;
    currentFileContext?: GitLabChatFileContext;
    additionalContext?: AiContextItemRequestType[];
    clientSubscriptionId?: string;
    conversationType?: ConversationTypeType;
    threadId?: GitLabGID;
  }): Promise<AiActionResponseType> {
    const platform = await this.#currentPlatform();
    const { query, defaultVariables } = await this.#actionMutation();
    const projectGqlId = await this.#manager.getProjectGqlId();
    const request: GraphQLRequest<AiActionResponseType> = {
      type: 'graphql',
      query,
      variables: {
        ...variables,
        ...defaultVariables,
        resourceId: projectGqlId ?? null,
      },
    };

    return platform.fetchFromApi(request);
  }

  async #actionMutation(): Promise<ChatInputTemplate> {
    if (!this.#cachedActionMutation) {
      const platform = await this.#currentPlatform();

      try {
        const [{ version }, isAdditionalContextEnabled] = await Promise.all([
          platform.fetchFromApi(versionRequest),
          this.#aiContextManager.isAdditionalContextEnabled(),
        ]);
        const settings = {
          version,
          isAdditionalContextEnabled,
          actionMutation: ifVersionGte<ChatInputTemplate>(
            version,
            MINIMUM_CONVERSATION_TYPE_VERSION,
            () => CHAT_INPUT_TEMPLATE_17_10_AND_LATER,
            () =>
              ifVersionGte<ChatInputTemplate>(
                version,
                MINIMUM_PLATFORM_ORIGIN_FIELD_VERSION,
                () =>
                  isAdditionalContextEnabled
                    ? CHAT_INPUT_TEMPLATE_17_5_AND_LATER
                    : CHAT_INPUT_TEMPLATE_17_3_AND_LATER,
                () => CHAT_INPUT_TEMPLATE_17_2_AND_EARLIER,
              ),
          ),
        };
        this.#cachedActionMutation = settings.actionMutation;
        log.debug(`GitLabChatApi: action mutation settings: ${JSON.stringify(settings, null, 2)}`);
      } catch (e) {
        log.debug(`GitLab version check for sending chat failed:`, e);
        this.#cachedActionMutation = CHAT_INPUT_TEMPLATE_17_3_AND_LATER;
      }
    }

    return this.#cachedActionMutation;
  }

  async #messagesQuery(): Promise<string> {
    if (!this.#cachedMessagesQuery) {
      const platform = await this.#currentPlatform();

      try {
        const [{ version }, isAdditionalContextEnabled] = await Promise.all([
          platform.fetchFromApi(versionRequest),
          this.#aiContextManager.isAdditionalContextEnabled(),
        ]);
        const settings = {
          version,
          isAdditionalContextEnabled,
          messagesQuery: ifVersionGte<string>(
            version,
            MINIMUM_ADDITIONAL_CONTEXT_FIELD_VERSION,
            () => AI_MESSAGES_QUERY_17_5_AND_LATER,
            () => AI_MESSAGES_QUERY,
          ),
        };
        this.#cachedMessagesQuery = settings.messagesQuery;
        log.debug(`GitChatApi: messages query settings: ${JSON.stringify(settings, null, 2)}`);
      } catch (e) {
        log.debug(`GitLab version check for sending chat failed:`, e);
        this.#cachedMessagesQuery = AI_MESSAGES_QUERY;
      }
    }

    return this.#cachedMessagesQuery;
  }
}
