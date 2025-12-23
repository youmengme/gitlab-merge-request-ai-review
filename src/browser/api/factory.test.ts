import { NoopAuthentication } from '../auth/noop_authentication';
import { DefaultApiClient } from '../../common/gitlab/api/api_client';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { Authentication } from '../auth';
import { createApiClient } from './factory';
import { MediatorCommandsApiClient } from './mediator_commands_api_client';

jest.mock('../../common/gitlab/api/api_client');

const TEST_INSTANCE_URL = 'http://localhost:3000';
const TEST_AUTHENTICATION: Authentication = createFakePartial<Authentication>({
  getSession: () => ({
    accessToken: 'test-token',
    account: {
      id: 'test-id',
      label: 'test-label',
    },
    id: 'test-id',
    scopes: ['api'],
  }),
});

describe('browser/api/factory', () => {
  describe('createApiClient', () => {
    it('when auth does not have accessToken, creates MediatorCommandsApiClient', () => {
      const client = createApiClient(TEST_INSTANCE_URL, new NoopAuthentication());

      expect(client).toBeInstanceOf(MediatorCommandsApiClient);
    });

    it('when auth has accessToken, creates DefaultApiClient', () => {
      const client = createApiClient(TEST_INSTANCE_URL, TEST_AUTHENTICATION);

      expect(client).toBeInstanceOf(DefaultApiClient);
      expect(DefaultApiClient).toHaveBeenCalledWith({
        instanceUrl: TEST_INSTANCE_URL,
        authProvider: {
          getAuthHeaders: expect.any(Function),
        },
      });
    });

    it('when auth has accessToken, authProvider.getAuthHeaders returns correct headers', async () => {
      createApiClient(TEST_INSTANCE_URL, TEST_AUTHENTICATION);

      const headers = await jest
        .mocked(DefaultApiClient)
        .mock.calls[0]?.[0]?.authProvider?.getAuthHeaders();

      expect(headers).toEqual({
        Authorization: 'Bearer test-token',
      });
    });
  });
});
