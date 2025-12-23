import type { ApiClient } from '../../common/gitlab/api/api_client';
import type { Authentication } from '../auth';
import { DefaultApiClient } from '../../common/gitlab/api/api_client';
import { MediatorCommandsApiClient } from './mediator_commands_api_client';

export const createApiClient = (instanceUrl: string, authentication: Authentication): ApiClient => {
  // note: We only need to check this once here to know if we support auth tokens or not
  const hasAuthToken = Boolean(authentication.getSession().accessToken);

  if (hasAuthToken) {
    return new DefaultApiClient({
      instanceUrl,
      authProvider: {
        async getAuthHeaders() {
          // note: It's important that we *refetch* `getSession` here, to make sure we have the latest.
          return {
            Authorization: `Bearer ${authentication.getSession().accessToken}`,
          };
        },
      },
    });
  }

  return new MediatorCommandsApiClient();
};
