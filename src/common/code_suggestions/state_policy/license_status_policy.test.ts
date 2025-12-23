import { GitLabPlatform } from '../../platform/gitlab_platform';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { gitlabPlatformForAccount } from '../../test_utils/entities';
import { getSuggestionsAvailability } from '../api/get_code_suggestion_availability';
import { GitLabPlatformManagerForCodeSuggestions } from '../gitlab_platform_manager_for_code_suggestions';
import { createFakeFetchFromApi } from '../../test_utils/create_fake_fetch_from_api';
import { log } from '../../log';
import { LicenseStatusPolicy, NO_LICENSE } from './license_status_policy';
import { StatePolicy } from './state_policy';
import { createFakePolicy } from './test_utils/create_fake_policy';

jest.mock('../../log');

describe('LicenseStatusPolicy', () => {
  let platform: GitLabPlatform | undefined;
  let manager: GitLabPlatformManagerForCodeSuggestions;
  let policy: LicenseStatusPolicy;

  const setLicenseAvailable = (available: boolean) => {
    if (!platform) throw new Error('platform is undefined');
    platform.fetchFromApi = jest.fn(
      createFakeFetchFromApi({
        request: getSuggestionsAvailability(),
        response: {
          currentUser: { duoCodeSuggestionsAvailable: available },
        },
      }),
    );
  };

  beforeEach(() => {
    platform = {
      ...gitlabPlatformForAccount,
    };
    setLicenseAvailable(false);
    manager = createFakePartial<GitLabPlatformManagerForCodeSuggestions>({
      getGitLabPlatform: async () => platform,
      onAccountChange: jest.fn(),
    });
  });

  describe('with engaged dependency', () => {
    beforeEach(async () => {
      const engagedDependency = { ...createFakePolicy(), engaged: true };
      policy = new LicenseStatusPolicy(manager, [engagedDependency]);
      await policy.init();
    });

    it('is engaged by default', () => {
      expect(policy.engaged).toBe(true);
    });

    it('does not call API during init', () => {
      expect(platform?.fetchFromApi).not.toHaveBeenCalled();
    });

    it('does not call API when platform changes', async () => {
      await jest.mocked(manager.onAccountChange).mock.calls[0][0](platform);

      expect(platform?.fetchFromApi).not.toHaveBeenCalled();
    });
  });

  describe('with disengaged dependency', () => {
    let disengagedDependency: StatePolicy;
    beforeEach(async () => {
      disengagedDependency = { ...createFakePolicy(), engaged: false };
      policy = new LicenseStatusPolicy(manager, [disengagedDependency]);
      setLicenseAvailable(true);
      await policy.init();
    });

    it('initializes from API', async () => {
      expect(policy.engaged).toBe(false);
    });

    it('initializes as engaged if the platform is missing', async () => {
      platform = undefined;

      await policy.init();

      expect(policy.engaged).toBe(true);
    });

    it('initializes as engaged api call fails and logs error', async () => {
      const error = new Error('test API error');
      jest.mocked(platform!.fetchFromApi).mockRejectedValue(error);

      await policy.init();

      expect(log.error).toHaveBeenCalledWith(expect.any(String), error);
      expect(policy.engaged).toBe(true);
    });

    it('reacts on platform change', async () => {
      setLicenseAvailable(false);

      await jest.mocked(manager.onAccountChange).mock.calls[0][0](platform);

      expect(policy.engaged).toBe(true);
    });

    it('engages when all accounts are removed (platform is undefined)', async () => {
      await jest.mocked(manager.onAccountChange).mock.calls[0][0](undefined);

      expect(policy.engaged).toBe(true);
    });

    it('updates when dependency updates', async () => {
      setLicenseAvailable(false);
      // we have to engage and disengage the dependency to see change
      // when the dependency is engaged, this policy is not executing its refresh
      disengagedDependency.engaged = true;
      await jest.mocked(disengagedDependency.onEngagedChange).mock.calls[0][0](true);
      disengagedDependency.engaged = false;
      await jest.mocked(disengagedDependency.onEngagedChange).mock.calls[0][0](false);

      // hack because the combined policy loses the promise and we can't await it
      await new Promise(process.nextTick);
      expect(policy.engaged).toBe(true);
    });

    it('notifies listeners about changes to engaged', async () => {
      setLicenseAvailable(false);
      const listener = jest.fn();
      policy.onEngagedChange(listener);

      await policy.init();

      expect(listener).toHaveBeenCalledWith(true);
    });

    it('has correct visual state', () => {
      expect(policy.state).toBe(NO_LICENSE);
    });
  });
});
