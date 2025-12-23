import { GitLabPlatformManager } from '../platform/gitlab_platform';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { gitlabPlatformForAccount } from '../test_utils/entities';
import { CodeSuggestionsTokenManager, CompletionToken } from './code_suggestions_token_manager';
import {
  GitLabPlatformManagerForCodeSuggestions,
  GitLabPlatformManagerForCodeSuggestionsImpl,
} from './gitlab_platform_manager_for_code_suggestions';

describe('CodeSuggestionsTokenManager', () => {
  describe('getToken', () => {
    let makeApiRequest: jest.Mock;

    const createPlatformManager = (
      response: CompletionToken,
    ): GitLabPlatformManagerForCodeSuggestions => {
      makeApiRequest = jest.fn(async <T>(): Promise<T> => response as unknown as T);
      const manager = new GitLabPlatformManagerForCodeSuggestionsImpl(
        createFakePartial<GitLabPlatformManager>({
          onAccountChange: jest.fn().mockReturnValue({ dispose: () => {} }),
        }),
      );

      jest.spyOn(manager, 'getGitLabPlatform').mockResolvedValue({
        ...gitlabPlatformForAccount,
        fetchFromApi: makeApiRequest,
      });

      return manager;
    };

    it('should return a token', async () => {
      const tokenManager = new CodeSuggestionsTokenManager(
        createPlatformManager({
          access_token: '123',
          expires_in: 0,
          created_at: 0,
        }),
      );
      const token = await tokenManager.getToken();
      expect(token).not.toBe(undefined);
      expect(token?.access_token).toBe('123');
      expect(token?.expires_in).toBe(0);
      expect(token?.created_at).toBe(0);
    });

    it('should not call the service again if the token has not expired', async () => {
      const unixTimestampNow = Math.floor(new Date().getTime() / 1000);
      const mf = createPlatformManager({
        access_token: '123',
        expires_in: 3000,
        created_at: unixTimestampNow,
      });

      const tokenManager = new CodeSuggestionsTokenManager(mf);

      await tokenManager.getToken();
      await tokenManager.getToken();

      expect(makeApiRequest).toHaveBeenCalledTimes(1);
    });

    it('should call the service again if the token has expired', async () => {
      const unixTimestampExpired = Math.floor(new Date().getTime() / 1000) - 3001;

      const mf = createPlatformManager({
        access_token: '123',
        expires_in: 3000,
        created_at: unixTimestampExpired,
      });

      const tokenManager = new CodeSuggestionsTokenManager(mf);

      await tokenManager.getToken();
      await tokenManager.getToken();

      expect(makeApiRequest).toHaveBeenCalledTimes(2);
    });
  });
});
