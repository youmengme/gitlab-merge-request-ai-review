import { Channel, ChannelEvents } from '@anycable/core';
import { gql } from 'graphql-request';
import type { AIContextItem } from '@gitlab-org/gitlab-lsp';

type AiCompletionResponseInput = {
  htmlResponse?: boolean;
  userId: string;
  aiAction?: string;
  clientSubscriptionId?: string;
};

type AiCompletionResponseParams = {
  channel: 'GraphqlChannel';
  query: string;
  variables: string;
  operationName: 'aiCompletionResponse';
};

const AI_MESSAGE_SUBSCRIPTION_QUERY = gql`
  subscription aiCompletionResponse(
    $userId: UserID
    $clientSubscriptionId: String
    $aiAction: AiAction
    $htmlResponse: Boolean = true
  ) {
    aiCompletionResponse(
      userId: $userId
      aiAction: $aiAction
      clientSubscriptionId: $clientSubscriptionId
    ) {
      id
      requestId
      content
      contentHtml @include(if: $htmlResponse)
      errors
      role
      timestamp
      type
      chunkId
      extras {
        sources
      }
    }
  }
`;

const AI_MESSAGE_SUBSCRIPTION_QUERY_WITH_ADDITIONAL_CONTEXT = gql`
  subscription aiCompletionResponse(
    $userId: UserID
    $clientSubscriptionId: String
    $aiAction: AiAction
    $htmlResponse: Boolean = true
  ) {
    aiCompletionResponse(
      userId: $userId
      aiAction: $aiAction
      clientSubscriptionId: $clientSubscriptionId
    ) {
      id
      requestId
      content
      contentHtml @include(if: $htmlResponse)
      errors
      role
      timestamp
      type
      chunkId
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
`;

export type AiCompletionResponseMessageType = {
  requestId: string;
  role: string;
  content: string;
  timestamp: string;
  errors: string[];
  extras?: {
    sources: object[];
    additionalContext?: AIContextItem[];
  };
  chunkId?: number;
  type?: string;
};

type AiCompletionResponseResponseType = {
  result: {
    data: {
      aiCompletionResponse: AiCompletionResponseMessageType;
    };
  };
  more: boolean;
};

interface AiCompletionResponseChannelEvents
  extends ChannelEvents<AiCompletionResponseResponseType> {
  systemMessage: (msg: AiCompletionResponseMessageType) => void;
  newChunk: (msg: AiCompletionResponseMessageType) => void;
  fullMessage: (msg: AiCompletionResponseMessageType) => void;
}

export class AiCompletionResponseChannel extends Channel<
  AiCompletionResponseParams,
  AiCompletionResponseResponseType,
  AiCompletionResponseChannelEvents
> {
  static identifier = 'GraphqlChannel';

  constructor(params: AiCompletionResponseInput, additionalContextEnabled: boolean) {
    super({
      channel: 'GraphqlChannel',
      operationName: 'aiCompletionResponse',
      query: additionalContextEnabled
        ? AI_MESSAGE_SUBSCRIPTION_QUERY_WITH_ADDITIONAL_CONTEXT
        : AI_MESSAGE_SUBSCRIPTION_QUERY,
      variables: JSON.stringify(params),
    });
  }

  receive(message: AiCompletionResponseResponseType) {
    if (!message.result.data.aiCompletionResponse) return;

    const data = message.result.data.aiCompletionResponse;

    if (data.role.toLowerCase() === 'system') {
      this.emit('systemMessage', data);
    } else if (data.chunkId) {
      this.emit('newChunk', data);
    } else {
      this.emit('fullMessage', data);
    }
  }
}
