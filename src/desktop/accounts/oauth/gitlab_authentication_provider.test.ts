import { createOAuthAccount, createTokenAccount } from '../../test_utils/entities';
import { AccountService } from '../account_service';
import { createExtensionContext } from '../../../common/test_utils/entities';
import { GitLabAuthenticationProvider } from './gitlab_authentication_provider';

describe('GitLabAuthenticationProvider', () => {
  let accountService: AccountService;
  const oauthAccount = createOAuthAccount('https://test.com', 1, 'oauth-1');
  const patAccount = createTokenAccount('https://test.com', 2, 'pat-1');

  beforeEach(async () => {
    accountService = new AccountService();
    await accountService.init(createExtensionContext());
  });

  describe('getting existing session', () => {
    it('gets a session if there is existing oauth account', async () => {
      await accountService.addAccount(oauthAccount);
      await accountService.addAccount(patAccount);
      const provider = new GitLabAuthenticationProvider(accountService);

      const [oauthSession, patSession] = await provider.getSessions(['api']);

      expect(oauthSession.accessToken).toBe(oauthAccount.token);
      expect(oauthSession.account.id).toBe(oauthAccount.id);
      expect(oauthSession.account.label).toBe('user1 - https://test.com');
      expect(patSession.accessToken).toBe(patAccount.token);
    });
  });

  describe('notifying of changes', () => {
    it('notifies about added accounts', async () => {
      const listener = jest.fn();
      const provider = new GitLabAuthenticationProvider(accountService);
      provider.onDidChangeSessions(listener);

      await accountService.addAccount(oauthAccount);

      expect(listener).toHaveBeenCalledWith({
        added: [expect.objectContaining({ accessToken: oauthAccount.token })],
        removed: [],
      });
    });

    it('notifies about removed accounts', async () => {
      const listener = jest.fn();
      const provider = new GitLabAuthenticationProvider(accountService);
      await accountService.addAccount(oauthAccount);
      provider.onDidChangeSessions(listener);

      await accountService.removeAccount(oauthAccount.id);

      expect(listener).toHaveBeenCalledWith({
        removed: [expect.objectContaining({ accessToken: oauthAccount.token })],
        added: [],
      });
    });
  });

  it('createSession throws an error', async () => {
    const provider = new GitLabAuthenticationProvider(accountService);

    await expect(provider.createSession()).rejects.toThrow(
      /Creating `gitlab.com` sessions .* is not supported/,
    );
  });

  it('removeSession deletes account', async () => {
    await accountService.addAccount(oauthAccount);
    const provider = new GitLabAuthenticationProvider(accountService);

    await provider.removeSession(oauthAccount.id);

    expect(accountService.getAllAccounts()).toHaveLength(0);
  });
});
