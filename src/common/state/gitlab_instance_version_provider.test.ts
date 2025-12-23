import { GitLabPlatformForAccount, GitLabPlatformManager } from '../platform/gitlab_platform';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { GitLabInstanceVersionProvider } from './gitlab_instance_version_provider';

describe('GitLabInstanceVersionProvider', () => {
  let platformManager: GitLabPlatformManager;
  let platformForAccount: GitLabPlatformForAccount;
  let versionProvider: GitLabInstanceVersionProvider;

  beforeEach(() => {
    platformManager = createFakePartial<GitLabPlatformManager>({
      onAccountChange: jest.fn(),
      getForActiveAccount: jest.fn().mockResolvedValue(platformForAccount),
    });
    versionProvider = new GitLabInstanceVersionProvider(platformManager);
  });

  describe('constructor', () => {
    it('should register account change handler', () => {
      expect(platformManager.onAccountChange).toHaveBeenCalled();
    });
  });

  describe('updateVersion', () => {
    it('version should be undefined when no platform is available', async () => {
      await versionProvider.updateVersion();

      expect(versionProvider.version).toBeUndefined();
    });

    it('should fetch and set version when platform is available', async () => {
      platformForAccount = createFakePartial<GitLabPlatformForAccount>({
        fetchFromApi: jest.fn().mockResolvedValue({ version: '14.0.0' }),
      });
      jest.mocked(platformManager.getForActiveAccount).mockResolvedValue(platformForAccount);

      await versionProvider.updateVersion();

      expect(versionProvider.version).toBe('14.0.0');
    });
  });
});
