import assert from 'assert';
import vscode from 'vscode';
import { ExchangeTokenResponse, GitLabService } from '../../gitlab/gitlab_service';
import { GitLabUriHandler } from '../../gitlab_uri_handler';
import { openUrl } from '../../commands/openers';
import { createFakeFetchFromApi } from '../../../common/test_utils/create_fake_fetch_from_api';
import { currentUserRequest } from '../../../common/gitlab/api/get_current_user';
import { doNotAwait } from '../../../common/utils/do_not_await';
import { GITLAB_COM_URL } from '../../../common/constants';
import { Credentials } from '../../../common/platform/gitlab_account';
import {
  BUNDLED_CLIENT_IDS,
  getAuthenticationConfiguration,
} from '../../utils/extension_configuration';
import { OAuthFlow } from './oauth_flow';

jest.mock('../../commands/openers');
jest.mock('../../gitlab/gitlab_service');
jest.mock('../../utils/extension_configuration');
jest.useFakeTimers();

/* This method simulates the first response from GitLab OAuth, it accepts the authentication URL and returns redirect URL */
const fakeOAuthService = (urlString: string): string => {
  const url = new URL(urlString);
  const params = url.searchParams;
  assert.strictEqual(params.get('client_id'), BUNDLED_CLIENT_IDS[GITLAB_COM_URL]);
  assert.strictEqual(params.get('redirect_uri'), 'vscode://gitlab.gitlab-workflow/authentication');
  assert.strictEqual(params.get('response_type'), 'code');
  assert.strictEqual(params.get('scope'), 'api');
  assert.strictEqual(params.get('code_challenge_method'), 'S256');
  assert(params.get('state'));
  assert(params.get('code_challenge'));

  const responseParams = new URLSearchParams({ state: params.get('state') || '', code: 'abc' });
  return `${params.get('redirect_uri')}?${responseParams}`;
};

describe('OAuthFlow', () => {
  let uriHandler: GitLabUriHandler;
  const mockGetAuthenticationConfiguration = jest.mocked(getAuthenticationConfiguration);

  beforeEach(async () => {
    uriHandler = new GitLabUriHandler();
    const exchangeToken: ExchangeTokenResponse = {
      access_token: 'test_token',
      expires_in: 7200,
      refresh_token: '**********',
      created_at: 0,
    };

    // Default configuration for GitLab.com
    mockGetAuthenticationConfiguration.mockReturnValue({
      oauthClientIds: {
        [GITLAB_COM_URL]: BUNDLED_CLIENT_IDS[GITLAB_COM_URL],
      },
    });

    jest.mocked(GitLabService.exchangeToken).mockResolvedValue(exchangeToken);
    jest.mocked(GitLabService).mockImplementation(() => {
      return {
        fetchFromApi: createFakeFetchFromApi({
          request: currentUserRequest,
          response: { id: 123, username: 'test_user' },
        }),
      } as GitLabService;
    });
  });

  describe('authenticate', () => {
    describe('when user authenticates the request', () => {
      beforeEach(() => {
        jest.mocked(openUrl).mockImplementationOnce(async urlString => {
          uriHandler.fire(vscode.Uri.parse(fakeOAuthService(urlString)));
        });
      });

      it('authenticates', async () => {
        const flow = new OAuthFlow(uriHandler);

        const account = await flow.authenticate(GITLAB_COM_URL);

        expect(account?.id).toEqual('https://gitlab.com|123');
        expect(account?.token).toEqual('test_token');
        expect(vscode.window.withProgress).toHaveBeenCalledWith(
          {
            title: 'Waiting for OAuth redirect from https://gitlab.com.',
            location: vscode.ProgressLocation.Notification,
          },
          expect.any(Function),
        );
      });
    });

    describe('when user does not authenticate the request', () => {
      beforeEach(() => {
        jest.mocked(openUrl).mockImplementation(async () => {
          /* noop */
        });
      });

      it('cancels OAuth login after 60s', async () => {
        const flow = new OAuthFlow(uriHandler);

        const resultPromise = flow.authenticate(GITLAB_COM_URL);

        // if we await the result this function call, the rejected promise fails the test before we reach the assertion ¯\_(ツ)_/¯
        // I do not know why that's happening, but after an hour of looking into fake timers implementation I give up
        // I verified that the test fails if the production code timeout doesn't work.
        // if you want to investigate for yourself, start here https://stackoverflow.com/a/51132058/606571
        doNotAwait(jest.advanceTimersByTimeAsync(61000));

        await expect(resultPromise).rejects.toThrow(/Cancelling the GitLab OAuth login after 60s/);
      });
    });
  });

  describe('supportsGitLabInstance', () => {
    it('returns true when OAuth client ID is configured for the instance', () => {
      mockGetAuthenticationConfiguration.mockReturnValue({
        oauthClientIds: {
          'https://gitlab.com': 'gitlab-com-client-id',
          'https://self-managed.example.com': 'self-managed-client-id',
        },
      });

      const flow = new OAuthFlow(uriHandler);

      expect(flow.supportsGitLabInstance('https://gitlab.com')).toBe(true);
      expect(flow.supportsGitLabInstance('https://self-managed.example.com')).toBe(true);
    });

    it('returns false when OAuth client ID is not configured for the instance', () => {
      mockGetAuthenticationConfiguration.mockReturnValue({
        oauthClientIds: {
          'https://gitlab.com': 'gitlab-com-client-id',
        },
      });

      const flow = new OAuthFlow(uriHandler);

      expect(flow.supportsGitLabInstance('https://unconfigured.example.com')).toBe(false);
    });

    it('returns false when OAuth client ID is empty string', () => {
      mockGetAuthenticationConfiguration.mockReturnValue({
        oauthClientIds: {
          'https://gitlab.com': '',
        },
      });

      const flow = new OAuthFlow(uriHandler);

      expect(flow.supportsGitLabInstance('https://gitlab.com')).toBe(false);
    });

    it('returns false when OAuth client ID is undefined', () => {
      mockGetAuthenticationConfiguration.mockReturnValue({
        oauthClientIds: {
          'https://gitlab.com': undefined,
        },
      });

      const flow = new OAuthFlow(uriHandler);

      expect(flow.supportsGitLabInstance('https://gitlab.com')).toBe(false);
    });
  });

  describe('authenticate with multiple instances', () => {
    const selfManagedUrl = 'https://self-managed.example.com';
    const dedicatedUrl = 'https://dedicated.gitlab.com';

    beforeEach(() => {
      mockGetAuthenticationConfiguration.mockReturnValue({
        oauthClientIds: {
          [GITLAB_COM_URL]: BUNDLED_CLIENT_IDS[GITLAB_COM_URL],
          [selfManagedUrl]: 'self-managed-client-id',
          [dedicatedUrl]: 'dedicated-client-id',
        },
      });
    });

    it('authenticates with self-managed GitLab instance', async () => {
      const exchangeToken: ExchangeTokenResponse = {
        access_token: 'self_managed_token',
        expires_in: 3600,
        refresh_token: 'self_managed_refresh',
        created_at: 1234567890,
      };

      jest.mocked(GitLabService.exchangeToken).mockResolvedValue(exchangeToken);
      jest.mocked(GitLabService).mockImplementation(({ instanceUrl, token }: Credentials) => {
        assert.strictEqual(instanceUrl, selfManagedUrl);
        assert.strictEqual(token, 'self_managed_token');
        return {
          fetchFromApi: createFakeFetchFromApi({
            request: currentUserRequest,
            response: { id: 456, username: 'self_managed_user' },
          }),
        } as GitLabService;
      });

      jest.mocked(openUrl).mockImplementationOnce(async urlString => {
        // Simulate OAuth service response for self-managed instance
        const url = new URL(urlString);
        const params = url.searchParams;
        expect(url.origin).toBe(selfManagedUrl);
        expect(params.get('client_id')).toBe('self-managed-client-id');

        const responseParams = new URLSearchParams({
          state: params.get('state') || '',
          code: 'self_managed_code',
        });
        uriHandler.fire(vscode.Uri.parse(`${params.get('redirect_uri')}?${responseParams}`));
      });

      const flow = new OAuthFlow(uriHandler);
      const account = await flow.authenticate(selfManagedUrl);

      expect(account?.id).toEqual(`${selfManagedUrl}|456`);
      expect(account?.token).toEqual('self_managed_token');
      expect(account?.instanceUrl).toEqual(selfManagedUrl);
      expect(vscode.window.withProgress).toHaveBeenCalledWith(
        {
          title: `Waiting for OAuth redirect from ${selfManagedUrl}.`,
          location: vscode.ProgressLocation.Notification,
        },
        expect.any(Function),
      );
    });

    it('authenticates with GitLab Dedicated instance', async () => {
      const exchangeToken: ExchangeTokenResponse = {
        access_token: 'dedicated_token',
        expires_in: 7200,
        refresh_token: 'dedicated_refresh',
        created_at: 1234567890,
      };

      jest.mocked(GitLabService.exchangeToken).mockResolvedValue(exchangeToken);
      jest.mocked(GitLabService).mockImplementation(({ instanceUrl, token }: Credentials) => {
        assert.strictEqual(instanceUrl, dedicatedUrl);
        assert.strictEqual(token, 'dedicated_token');
        return {
          fetchFromApi: createFakeFetchFromApi({
            request: currentUserRequest,
            response: { id: 789, username: 'dedicated_user' },
          }),
        } as GitLabService;
      });

      jest.mocked(openUrl).mockImplementationOnce(async urlString => {
        const url = new URL(urlString);
        const params = url.searchParams;
        expect(url.origin).toBe(dedicatedUrl);
        expect(params.get('client_id')).toBe('dedicated-client-id');

        const responseParams = new URLSearchParams({
          state: params.get('state') || '',
          code: 'dedicated_code',
        });
        uriHandler.fire(vscode.Uri.parse(`${params.get('redirect_uri')}?${responseParams}`));
      });

      const flow = new OAuthFlow(uriHandler);
      const account = await flow.authenticate(dedicatedUrl);

      expect(account?.id).toEqual(`${dedicatedUrl}|789`);
      expect(account?.token).toEqual('dedicated_token');
      expect(account?.instanceUrl).toEqual(dedicatedUrl);
    });

    it('returns undefined for unsupported instances', async () => {
      const flow = new OAuthFlow(uriHandler);
      const account = await flow.authenticate('https://unsupported.example.com');

      expect(account).toBeUndefined();
    });

    it('handles multiple concurrent authentication requests', async () => {
      const flow = new OAuthFlow(uriHandler);

      // Mock different responses for different instances
      let callCount = 0;
      jest.mocked(GitLabService.exchangeToken).mockImplementation(async () => {
        callCount++;
        return {
          access_token: `token_${callCount}`,
          expires_in: 3600,
          refresh_token: `refresh_${callCount}`,
          created_at: 1234567890,
        };
      });

      jest.mocked(GitLabService).mockImplementation(() => {
        return {
          fetchFromApi: createFakeFetchFromApi({
            request: currentUserRequest,
            response: { id: callCount, username: `user_${callCount}` },
          }),
        } as GitLabService;
      });

      jest.mocked(openUrl).mockImplementation(async urlString => {
        const url = new URL(urlString);
        const params = url.searchParams;
        const responseParams = new URLSearchParams({
          state: params.get('state') || '',
          code: `code_for_${url.origin}`,
        });
        uriHandler.fire(vscode.Uri.parse(`${params.get('redirect_uri')}?${responseParams}`));
      });

      // Start multiple authentication requests
      const [gitlabComAccount, selfManagedAccount] = await Promise.all([
        flow.authenticate(GITLAB_COM_URL),
        flow.authenticate(selfManagedUrl),
      ]);

      expect(gitlabComAccount?.instanceUrl).toBe(GITLAB_COM_URL);
      expect(selfManagedAccount?.instanceUrl).toBe(selfManagedUrl);
      expect(gitlabComAccount?.id).not.toBe(selfManagedAccount?.id);
    });
  });

  describe('error handling', () => {
    it('handles OAuth client ID configuration errors gracefully', async () => {
      mockGetAuthenticationConfiguration.mockReturnValue({
        oauthClientIds: {
          'https://gitlab.com': '', // Empty client ID
        },
      });

      const flow = new OAuthFlow(uriHandler);
      const account = await flow.authenticate('https://gitlab.com');

      expect(account).toBeUndefined();
    });

    it('handles token exchange failures', async () => {
      jest
        .mocked(GitLabService.exchangeToken)
        .mockRejectedValue(new Error('Token exchange failed'));

      jest.mocked(openUrl).mockImplementationOnce(async urlString => {
        const url = new URL(urlString);
        const params = url.searchParams;
        const responseParams = new URLSearchParams({
          state: params.get('state') || '',
          code: 'test_code',
        });
        uriHandler.fire(vscode.Uri.parse(`${params.get('redirect_uri')}?${responseParams}`));
      });

      const flow = new OAuthFlow(uriHandler);

      await expect(flow.authenticate(GITLAB_COM_URL)).rejects.toThrow('Token exchange failed');
    });

    it('handles user API request failures', async () => {
      const exchangeToken: ExchangeTokenResponse = {
        access_token: 'test_token',
        expires_in: 7200,
        refresh_token: 'test_refresh',
        created_at: 0,
      };

      jest.mocked(GitLabService.exchangeToken).mockResolvedValue(exchangeToken);
      jest.mocked(GitLabService).mockImplementation(() => {
        return {
          fetchFromApi: jest.fn().mockRejectedValue(new Error('User API request failed')),
        } as unknown as GitLabService;
      });

      jest.mocked(openUrl).mockImplementationOnce(async urlString => {
        const url = new URL(urlString);
        const params = url.searchParams;
        const responseParams = new URLSearchParams({
          state: params.get('state') || '',
          code: 'test_code',
        });
        uriHandler.fire(vscode.Uri.parse(`${params.get('redirect_uri')}?${responseParams}`));
      });

      const flow = new OAuthFlow(uriHandler);

      await expect(flow.authenticate(GITLAB_COM_URL)).rejects.toThrow('User API request failed');
    });
  });
});
