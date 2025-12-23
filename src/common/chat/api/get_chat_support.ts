import { gql } from 'graphql-request';
import { GraphQLRequest } from '../../platform/web_ide';
import { GitLabPlatformForAccount } from '../../platform/gitlab_platform';
import { log } from '../../log';

const queryGetChatAvailability = gql`
  query duoChatAvailable {
    currentUser {
      duoChatAvailable
    }
  }
`;

export interface ChatSupportResponseInterface {
  hasSupportForChat: boolean;
  platform?: GitLabPlatformForAccount;
}

export type ChatAvailableResponseType = {
  currentUser: {
    duoChatAvailable: boolean;
  };
};

export async function getChatSupport(
  platform?: GitLabPlatformForAccount | undefined,
): Promise<ChatSupportResponseInterface> {
  const request: GraphQLRequest<ChatAvailableResponseType> = {
    type: 'graphql',
    query: queryGetChatAvailability,
    variables: {},
  };
  const noSupportResponse: ChatSupportResponseInterface = { hasSupportForChat: false };

  if (!platform) {
    return noSupportResponse;
  }
  try {
    const {
      currentUser: { duoChatAvailable },
    } = await platform.fetchFromApi(request);
    if (duoChatAvailable) {
      return {
        hasSupportForChat: duoChatAvailable,
        platform,
      };
    }
    return noSupportResponse;
  } catch (e) {
    log.error(e);
    return noSupportResponse;
  }
}
