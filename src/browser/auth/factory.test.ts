import * as vscode from 'vscode';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { resolveAuthentication } from './factory';
import { NoopAuthentication } from './noop_authentication';
import { getWebIdeAuthSession, WebIdeAuthentication } from './web_ide_authentication';

jest.mock('./web_ide_authentication');

const TEST_AUTH_SESSION: vscode.AuthenticationSession =
  createFakePartial<vscode.AuthenticationSession>({
    accessToken: 'test-access-token',
    id: 'test-id',
    scopes: ['test-scope'],
  });

describe('browser/auth/factory', () => {
  describe('resolveAuthentication', () => {
    it('with no auth session, returns noop authentication', async () => {
      const actual = await resolveAuthentication();

      expect(actual).toBeInstanceOf(NoopAuthentication);
    });

    it('with web ide auth session, returns web ide authentication', async () => {
      jest.mocked(getWebIdeAuthSession).mockResolvedValue(TEST_AUTH_SESSION);

      const actual = await resolveAuthentication();

      expect(actual).toBeInstanceOf(WebIdeAuthentication);
      expect(WebIdeAuthentication).toHaveBeenCalledWith(TEST_AUTH_SESSION);
    });
  });
});
