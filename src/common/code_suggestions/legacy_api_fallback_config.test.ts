import { GitLabPlatformManager } from '../platform/gitlab_platform';
import { gitlabPlatformForAccount } from '../test_utils/entities';
import { createFakePartial } from '../test_utils/create_fake_partial';
import {
  GitLabPlatformManagerForCodeSuggestions,
  GitLabPlatformManagerForCodeSuggestionsImpl,
} from './gitlab_platform_manager_for_code_suggestions';
import { LegacyApiFallbackConfig } from './legacy_api_fallback_config';

const fetchFromApiMock = jest.fn();

describe('LegacyApiFallbackConfig', () => {
  let config: LegacyApiFallbackConfig;
  let manager: GitLabPlatformManagerForCodeSuggestions;

  beforeEach(() => {
    manager = new GitLabPlatformManagerForCodeSuggestionsImpl(
      createFakePartial<GitLabPlatformManager>({
        onAccountChange: jest.fn().mockReturnValue({ dispose: () => {} }),
      }),
    );
    jest.spyOn(manager, 'getGitLabPlatform').mockResolvedValue({
      ...gitlabPlatformForAccount,
      fetchFromApi: fetchFromApiMock,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('for non legacy api', () => {
    beforeEach(async () => {
      const apiResponse = {
        version: '16.2',
      };
      fetchFromApiMock.mockResolvedValue(apiResponse);
      config = new LegacyApiFallbackConfig(manager);
      await config.verifyGitLabVersion();
    });

    it('does fallback by default', () => {
      expect(config.shouldUseModelGateway()).toBe(true);
    });
  });

  describe('for non legacy api', () => {
    beforeEach(async () => {
      const apiResponse = {
        version: '16.3',
      };
      fetchFromApiMock.mockResolvedValue(apiResponse);
      config = new LegacyApiFallbackConfig(manager);
      await config.verifyGitLabVersion();
    });

    it('does not fallback by default', () => {
      expect(config.shouldUseModelGateway()).toBe(false);
    });
  });
});
